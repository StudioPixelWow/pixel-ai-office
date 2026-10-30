-- applied migration: office_0003b_helpers (version 20261030072448)
create or replace function office.instantiate_workflow(p_org uuid, p_request uuid, p_key text, p_client uuid, p_project uuid,
  p_params jsonb, p_idem text, p_content_item uuid default null, p_agent_override text default null, p_title_prefix text default null)
returns uuid language plpgsql security definer set search_path = office, public as $$
declare t office.workflow_templates; wf uuid; s jsonb; ids jsonb := '{}'::jsonb; tid uuid; deps uuid[]; d text; v_agent text; v_ver int;
begin
  select * into t from office.workflow_templates where key = p_key;
  if t.key is null then raise exception 'unknown_workflow:%', p_key; end if;
  select id into wf from office.workflow_runs where org_id = p_org and idempotency_key = p_idem;
  if wf is not null then return wf; end if;
  insert into office.workflow_runs(org_id, request_id, workflow_key, client_id, project_id, params, idempotency_key)
  values (p_org, p_request, p_key, p_client, p_project, coalesce(p_params,'{}'::jsonb), p_idem) returning id into wf;
  for s in select * from jsonb_array_elements(t.steps) loop
    deps := '{}';
    for d in select jsonb_array_elements_text(coalesce(s->'depends','[]'::jsonb)) loop deps := deps || (ids->>d)::uuid; end loop;
    v_agent := coalesce(nullif(s->>'agent',''), p_agent_override);
    select current_version into v_ver from office.agent_definitions where id = v_agent;
    insert into office.task_runs(org_id, workflow_run_id, request_id, step_key, title, agent_id, agent_version, client_id, project_id,
      content_item_id, depends_on, required_capabilities, inputs, idempotency_key, stage)
    values (p_org, wf, p_request, s->>'key', coalesce(p_title_prefix||' · ','')||(s->>'title'), v_agent, v_ver, p_client, p_project,
      p_content_item, deps, coalesce(array(select jsonb_array_elements_text(coalesce(s->'caps','[]'::jsonb))),'{}'),
      jsonb_build_object('kind', s->>'kind', 'output_kind', s->>'output_kind', 'params', coalesce(p_params,'{}'::jsonb)),
      p_idem||':'||(s->>'key'), 'בתור') returning id into tid;
    ids := ids || jsonb_build_object(s->>'key', tid);
  end loop;
  perform office.emit(p_org, 'workflow.created', t.name, null, wf, p_request, null, p_client, jsonb_build_object('workflow', p_key));
  return wf;
end $$;

create or replace function office.proposal_totals(p_setup numeric, p_monthly numeric, p_media numeric, p_terms uuid) returns jsonb
language plpgsql stable security definer set search_path = office, public as $$
declare tt office.terms_templates; r jsonb;
begin
  select * into tt from office.terms_templates where id = p_terms;
  r := jsonb_build_object('setup', p_setup, 'monthly', p_monthly, 'media_budget_separate', p_media, 'currency', coalesce(tt.currency,'ILS'));
  if tt.id is null or tt.vat_rate is null or tt.prices_include_vat is null then
    r := r || jsonb_build_object('vat', 'not_configured', 'vat_note', 'שיעור מע״מ ואופן הכללה טרם הוגדרו בתבנית תנאים מאושרת');
  else
    r := r || jsonb_build_object('vat_rate', tt.vat_rate, 'prices_include_vat', tt.prices_include_vat,
      'setup_with_vat', case when p_setup is null then null when tt.prices_include_vat then p_setup else round(p_setup * (1 + tt.vat_rate/100), 2) end,
      'monthly_with_vat', case when p_monthly is null then null when tt.prices_include_vat then p_monthly else round(p_monthly * (1 + tt.vat_rate/100), 2) end);
  end if;
  return r;
end $$;

create or replace function office.draft_hash(d office.message_drafts) returns text
language sql immutable set search_path = office, public, extensions as $$
  select encode(extensions.digest(jsonb_build_object('v', d.draft_version, 'sender', d.sender_connection_id, 'to', d.recipient_e164,
    'contact', d.contact_id, 'conv', d.conversation_id, 'body', d.body, 'template', d.template_name, 'tparams', d.template_params,
    'att', d.attachments)::text, 'sha256'), 'hex') $$;

create or replace function office.draft_touch() returns trigger language plpgsql set search_path = office, public as $$
begin
  if tg_op = 'UPDATE' and (new.body is distinct from old.body or new.recipient_e164 is distinct from old.recipient_e164
     or new.attachments is distinct from old.attachments or new.sender_connection_id is distinct from old.sender_connection_id
     or new.template_name is distinct from old.template_name or new.template_params is distinct from old.template_params
     or new.contact_id is distinct from old.contact_id or new.conversation_id is distinct from old.conversation_id) then
    new.draft_version := old.draft_version + 1;
    if new.status in ('sending','accepted','delivered','read') then raise exception 'draft_locked_after_send'; end if;
  end if;
  new.snapshot_hash := office.draft_hash(new);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists draft_touch on office.message_drafts;
create trigger draft_touch before insert or update on office.message_drafts for each row execute function office.draft_touch();

create or replace function office.artifact_version_guard() returns trigger language plpgsql set search_path = office, public as $$
begin
  if old.review_status = 'approved' and (new.body is distinct from old.body or new.data is distinct from old.data
     or new.storage_path is distinct from old.storage_path or new.export_path is distinct from old.export_path or new.sha256 is distinct from old.sha256) then
    raise exception 'approved_version_is_immutable';
  end if;
  return new;
end $$;
drop trigger if exists artifact_version_guard on office.artifact_versions;
create trigger artifact_version_guard before update on office.artifact_versions for each row execute function office.artifact_version_guard();

create or replace function office.proposal_price_guard() returns trigger language plpgsql set search_path = office, public as $$
begin
  if (new.locked_setup is distinct from old.locked_setup or new.locked_monthly is distinct from old.locked_monthly
      or new.locked_media_budget is distinct from old.locked_media_budget)
     and coalesce(current_setting('office.price_write', true),'') <> 'owner' then
    raise exception 'locked_price_change_rejected';
  end if;
  return new;
end $$;
drop trigger if exists proposal_price_guard on office.proposals;
create trigger proposal_price_guard before update on office.proposals for each row execute function office.proposal_price_guard();

create or replace function office.flag_dependents(p_artifact uuid, p_reason text) returns int
language plpgsql security definer set search_path = office, public as $$
declare n int;
begin
  with recursive dep as (
    select d.artifact_version_id from office.artifact_dependencies d join office.artifact_versions v on v.id = d.depends_on_version_id where v.artifact_id = p_artifact
    union
    select d.artifact_version_id from office.artifact_dependencies d join dep on d.depends_on_version_id = dep.artifact_version_id)
  update office.artifact_versions av set needs_update = true, needs_update_reason = p_reason
   where av.id in (select artifact_version_id from dep) and not av.needs_update;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function office.add_artifact_version(p_org uuid, p_client uuid, p_project uuid, p_content_item uuid, p_artifact uuid,
  p_kind text, p_title text, p_body text, p_data jsonb, p_agent text, p_task uuid, p_model text, p_user uuid, p_depends uuid[], p_diff text,
  p_mime text default 'text/markdown', p_storage text default null, p_meta jsonb default '{}'::jsonb)
returns office.artifact_versions language plpgsql security definer set search_path = office, public, extensions as $$
declare a uuid := p_artifact; v office.artifact_versions; n int; dv uuid;
begin
  if a is null then
    insert into office.artifacts(org_id, client_id, project_id, content_item_id, kind, title) values (p_org, p_client, p_project, p_content_item, p_kind, p_title) returning id into a;
  end if;
  update office.artifacts set current_version = current_version + 1, updated_at = now() where id = a returning current_version into n;
  update office.artifact_versions set review_status = 'superseded' where artifact_id = a and review_status in ('draft','in_review','changes_requested');
  insert into office.artifact_versions(artifact_id, version_no, body, data, created_by, created_by_agent, task_run_id, model, mime, sha256,
     storage_path, width, height, duration_ms, size_bytes, diff_summary, review_status)
  values (a, n, p_body, p_data, p_user, p_agent, p_task, p_model, p_mime,
     coalesce(p_meta->>'sha256', encode(extensions.digest(coalesce(p_body,'')||coalesce(p_data::text,''), 'sha256'), 'hex')),
     p_storage, (p_meta->>'width')::int, (p_meta->>'height')::int, (p_meta->>'duration_ms')::int, (p_meta->>'size_bytes')::bigint, p_diff, 'in_review')
  returning * into v;
  if p_depends is not null then
    foreach dv in array p_depends loop insert into office.artifact_dependencies values (v.id, dv) on conflict do nothing; end loop;
  end if;
  if n > 1 then perform office.flag_dependents(a, coalesce(p_diff, 'גרסה חדשה של '||p_title)); end if;
  return v;
end $$;

create or replace function office.resolve_attachments(p_ids jsonb) returns jsonb
language sql stable security definer set search_path = office, public as $$
  select coalesce(jsonb_agg(jsonb_build_object('artifact_version_id', v.id, 'sha256', v.sha256, 'title', a.title, 'version_no', v.version_no, 'kind', a.kind)), '[]'::jsonb)
  from office.artifact_versions v join office.artifacts a on a.id = v.artifact_id
  where v.id in (select (jsonb_array_elements_text(coalesce(p_ids,'[]'::jsonb)))::uuid) $$;
