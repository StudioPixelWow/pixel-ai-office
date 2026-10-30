-- applied migration: office_0006_blobs (version 20261030074116)
create table if not exists office.blobs (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references office.organizations(id),
  client_id uuid, project_id uuid, task_run_id uuid, kind text not null default 'artifact', mime text not null, size_bytes bigint not null,
  sha256 text not null, is_public boolean not null default false, data bytea, parts int not null default 1, complete boolean not null default true,
  created_at timestamptz not null default now());
create table if not exists office.blob_parts (blob_id uuid not null references office.blobs(id) on delete cascade, part int not null, data bytea not null, primary key (blob_id, part));
create table if not exists office.import_tokens (token_hash text primary key, org_id uuid not null, purpose text not null, expires_at timestamptz not null, created_by uuid not null);
alter table office.agent_definitions add column if not exists avatar_blob_id uuid, add column if not exists avatar_meta jsonb;
revoke all on office.blobs, office.blob_parts, office.import_tokens from public, anon, authenticated;
insert into office.read_entities(entity, table_name, client_col, admin_only, hidden_cols, default_order) values ('blobs','blobs','client_id',false,'{data}','created_at desc') on conflict do nothing;

create or replace function office.put_blob(p_org uuid, p_client uuid, p_project uuid, p_task uuid, p_kind text, p_mime text, p_b64 text, p_public boolean) returns uuid
language plpgsql security definer set search_path = office, public, extensions as $$
declare v_data bytea := decode(p_b64, 'base64'); v_id uuid;
begin
  if length(v_data) > 12*1024*1024 then raise exception 'blob_too_large_use_parts'; end if;
  insert into office.blobs(org_id, client_id, project_id, task_run_id, kind, mime, size_bytes, sha256, is_public, data)
  values (p_org, p_client, p_project, p_task, p_kind, p_mime, length(v_data), encode(extensions.digest(v_data,'sha256'),'hex'), p_public, v_data) returning id into v_id;
  return v_id;
end $$;

create or replace function public.office_worker_put_blob(p_secret text, p_task uuid, p_lease uuid, p_mime text, p_b64 text) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs; v_id uuid; b office.blobs;
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  v_id := office.put_blob(t.org_id, t.client_id, t.project_id, t.id, 'artifact', p_mime, p_b64, false);
  select * into b from office.blobs where id = v_id;
  return jsonb_build_object('blob_id', v_id, 'sha256', b.sha256, 'size_bytes', b.size_bytes, 'storage_path', 'blob:'||v_id);
end $$;

-- large files from the local runner, uploaded in parts
create or replace function public.office_runner_put_part(p_token text, p_task uuid, p_lease uuid, p_blob uuid, p_part int, p_total int, p_mime text, p_b64 text) returns jsonb
language plpgsql security definer set search_path = office, public, extensions as $$
declare r office.local_runners; t office.task_runs; v_id uuid := p_blob; v_all bytea; n int;
begin
  r := office.runner_auth(p_token);
  t := office.lease_ok(p_task, p_lease);
  if v_id is null then
    insert into office.blobs(org_id, client_id, project_id, task_run_id, kind, mime, size_bytes, sha256, parts, complete)
    values (t.org_id, t.client_id, t.project_id, t.id, 'video', p_mime, 0, '', p_total, false) returning id into v_id;
  end if;
  insert into office.blob_parts(blob_id, part, data) values (v_id, p_part, decode(p_b64,'base64')) on conflict (blob_id, part) do update set data = excluded.data;
  select count(*) into n from office.blob_parts where blob_id = v_id;
  if n = p_total then
    select string_agg(data, ''::bytea order by part) into v_all from office.blob_parts where blob_id = v_id;
    update office.blobs set size_bytes = length(v_all), sha256 = encode(extensions.digest(v_all,'sha256'),'hex'), complete = true where id = v_id;
  end if;
  return jsonb_build_object('blob_id', v_id, 'parts_received', n, 'complete', n = p_total,
    'sha256', (select sha256 from office.blobs where id = v_id), 'size_bytes', (select size_bytes from office.blobs where id = v_id));
end $$;

create or replace function public.office_get_blob(p_id uuid, p_part int default 1) returns jsonb
language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships; b office.blobs; v bytea;
begin
  m := office.ctx();
  select * into b from office.blobs where id = p_id and org_id = m.org_id;
  if b.id is null or not (b.is_public or office.can_project(m, b.client_id, b.project_id)) then raise exception 'not_found'; end if;
  if b.parts > 1 then select data into v from office.blob_parts where blob_id = b.id and part = p_part; else v := b.data; end if;
  return jsonb_build_object('mime', b.mime, 'size_bytes', b.size_bytes, 'parts', b.parts, 'sha256', b.sha256, 'b64', encode(v, 'base64'));
end $$;

create or replace function public.office_public_blob(p_id uuid) returns jsonb
language sql stable security definer set search_path = office, public as $$
  select jsonb_build_object('mime', mime, 'b64', encode(data,'base64')) from office.blobs where id = p_id and is_public and parts = 1 $$;

create or replace function public.office_create_import_token(p_purpose text) returns jsonb
language plpgsql security definer set search_path = office, public, extensions as $$
declare m office.memberships; v_tok text;
begin
  m := office.ctx();
  if m.role <> 'owner' then raise exception 'owner_only'; end if;
  if p_purpose not in ('avatars') then raise exception 'bad_purpose'; end if;
  v_tok := encode(extensions.gen_random_bytes(18),'hex');
  insert into office.import_tokens(token_hash, org_id, purpose, expires_at, created_by) values (encode(extensions.digest(v_tok,'sha256'),'hex'), m.org_id, p_purpose, now() + interval '30 minutes', m.user_id);
  return jsonb_build_object('token', v_tok, 'expires_in_minutes', 30);
end $$;

create or replace function public.office_avatar_import(p_token text, p_agent text, p_mime text, p_b64 text, p_meta jsonb) returns jsonb
language plpgsql security definer set search_path = office, public, extensions as $$
declare it office.import_tokens; v_id uuid;
begin
  select * into it from office.import_tokens where token_hash = encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') and purpose = 'avatars' and expires_at > now();
  if it.token_hash is null then raise exception 'bad_or_expired_token'; end if;
  if p_mime not in ('image/webp','image/png','image/jpeg') then raise exception 'bad_mime'; end if;
  if not exists(select 1 from office.agent_definitions where id = p_agent and org_id = it.org_id) then raise exception 'unknown_agent'; end if;
  if length(decode(p_b64,'base64')) > 1500000 then raise exception 'avatar_too_large'; end if;
  v_id := office.put_blob(it.org_id, null, null, null, 'avatar', p_mime, p_b64, true);
  update office.agent_definitions set avatar_blob_id = v_id, avatar_meta = coalesce(p_meta,'{}'::jsonb) || jsonb_build_object('imported_at', now()) where id = p_agent;
  perform office.audit(it.org_id,'user',it.created_by::text,'avatar_import','agent',p_agent,null,p_meta);
  return jsonb_build_object('blob_id', v_id);
end $$;

revoke execute on function public.office_worker_put_blob(text,uuid,uuid,text,text), public.office_runner_put_part(text,uuid,uuid,uuid,int,int,text,text),
  public.office_public_blob(uuid), public.office_avatar_import(text,text,text,text,jsonb) from public;
grant execute on function public.office_worker_put_blob(text,uuid,uuid,text,text), public.office_runner_put_part(text,uuid,uuid,uuid,int,int,text,text),
  public.office_public_blob(uuid), public.office_avatar_import(text,text,text,text,jsonb) to anon, authenticated;
revoke execute on function public.office_get_blob(uuid,int), public.office_create_import_token(text) from anon, public;
grant execute on function public.office_get_blob(uuid,int), public.office_create_import_token(text) to authenticated;

-- sandbox provider wire (test mode only, test numbers enforced at approval time)
create or replace function public.office_worker_sandbox_send(p_secret text, p_dispatch uuid) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; o office.outbox_dispatches; d office.message_drafts;
begin
  v_org := office.worker_org(p_secret);
  select * into o from office.outbox_dispatches where id = p_dispatch and status = 'claimed';
  if o.id is null then raise exception 'not_claimed'; end if;
  select * into d from office.message_drafts where id = o.draft_id;
  insert into office.sandbox_outbox(dispatch_key, recipient_e164, body, attachments) values (o.dispatch_key, d.recipient_e164, d.body, d.attachments) on conflict (dispatch_key) do nothing;
  return jsonb_build_object('provider_message_id', 'sandbox:'||o.dispatch_key);
end $$;
revoke execute on function public.office_worker_sandbox_send(text,uuid) from public;
grant execute on function public.office_worker_sandbox_send(text,uuid) to anon, authenticated;

-- the agent board exposes avatar ids
create or replace function office.agent_avatar(p_agent text) returns uuid language sql stable security definer set search_path = office, public as $$
  select avatar_blob_id from office.agent_definitions where id = p_agent $$;
