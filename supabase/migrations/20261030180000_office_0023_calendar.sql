-- Unified office calendar: meetings (two-way with Google Calendar), personal/office to-dos, milestones, posts and LOUD sessions.
alter table office.meetings add column if not exists kind text not null default 'meeting';
alter table office.meetings add column if not exists description text;
alter table office.meetings add column if not exists source text not null default 'office';
alter table office.meetings add column if not exists sync_state text not null default 'pending';
alter table office.meetings add column if not exists sync_error text;
alter table office.meetings add column if not exists all_day boolean not null default false;
alter table office.meetings add column if not exists created_by uuid;
alter table office.meetings add column if not exists google_updated timestamptz;
create unique index if not exists meetings_ext_uq on office.meetings(org_id, external_event_id) where external_event_id is not null;

create table if not exists office.todos (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references office.organizations(id), title text not null, notes text,
  due_at timestamptz, all_day boolean not null default true, client_id uuid references office.clients(id), assignee uuid, priority text not null default 'normal' check (priority in ('low','normal','high')),
  status text not null default 'open' check (status in ('open','done','cancelled')), done_at timestamptz, created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists todos_org_due on office.todos(org_id, status, due_at);
alter table office.todos enable row level security;

-- OAuth tokens are encrypted by the app (AES-GCM) before they reach the database; only the worker secret can read them.
create table if not exists office.oauth_tokens (
  org_id uuid not null references office.organizations(id), provider text not null, account_email text, token_enc text not null, scopes text,
  calendar_id text not null default 'primary', last_sync_at timestamptz, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (org_id, provider));
alter table office.oauth_tokens enable row level security;

create or replace function public.office_calendar(p_from timestamptz, p_to timestamptz) returns jsonb language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships;
begin
  m := office.ctx();
  return jsonb_build_object(
    'google', (select jsonb_build_object('connected', true, 'account', account_email, 'last_sync_at', last_sync_at, 'last_error', last_error) from office.oauth_tokens where org_id = m.org_id and provider = 'google_calendar'),
    'items', coalesce((select jsonb_agg(x order by x->>'start') from (
      select jsonb_build_object('id', mt.id, 'type', case when mt.title like '🎙%' then 'loud' else 'meeting' end, 'title', mt.title, 'start', mt.starts_at, 'end', mt.ends_at, 'all_day', mt.all_day,
        'location', mt.location, 'description', mt.description, 'client_id', mt.client_id, 'client', c.name, 'status', mt.status, 'source', mt.source, 'sync', mt.sync_state,
        'attendees', mt.attendees, 'href', case when mt.title like '🎙%' then '/loud/' || (select b.id from office.studio_bookings b where b.meeting_id = mt.id limit 1) end) x
        from office.meetings mt left join office.clients c on c.id = mt.client_id
        where mt.org_id = m.org_id and mt.status <> 'cancelled' and mt.starts_at < p_to and coalesce(mt.ends_at, mt.starts_at) >= p_from and (mt.client_id is null or office.can_client(m, mt.client_id))
      union all
      select jsonb_build_object('id', t.id, 'type', 'todo', 'title', t.title, 'start', coalesce(t.due_at, t.created_at), 'all_day', t.all_day, 'status', t.status, 'priority', t.priority,
        'notes', t.notes, 'client_id', t.client_id, 'client', c.name, 'overdue', t.status = 'open' and t.due_at < now())
        from office.todos t left join office.clients c on c.id = t.client_id
        where t.org_id = m.org_id and t.status <> 'cancelled' and ((t.due_at >= p_from and t.due_at < p_to) or (t.status = 'open' and t.due_at < p_from and p_from <= now()))
      union all
      select jsonb_build_object('id', ms.id, 'type', 'milestone', 'title', ms.title, 'start', (ms.due_date::timestamp at time zone 'Asia/Jerusalem'), 'all_day', true, 'status', ms.status,
        'client_id', ms.client_id, 'client', c.name, 'service', sc.label, 'href', '/clients/' || ms.client_id || '?tab=milestones', 'overdue', ms.status not in ('done','skipped') and ms.due_date < (now() at time zone 'Asia/Jerusalem')::date)
        from office.milestones ms join office.clients c on c.id = ms.client_id left join office.service_catalog sc on sc.key = ms.service_key
        where ms.org_id = m.org_id and ms.status <> 'skipped' and ms.due_date >= (p_from at time zone 'Asia/Jerusalem')::date and ms.due_date < (p_to at time zone 'Asia/Jerusalem')::date and office.can_client(m, ms.client_id)
      union all
      select jsonb_build_object('id', ci.id, 'type', 'post', 'title', coalesce(ci.topic, ci.idea, 'פוסט'), 'start', ci.due_at, 'all_day', true, 'status', ci.social_status, 'client_id', ci.client_id, 'client', c.name,
        'href', '/content?client=' || ci.client_id || '&m=' || to_char(ci.due_at at time zone 'Asia/Jerusalem','YYYY-MM'))
        from office.content_items ci join office.clients c on c.id = ci.client_id
        where ci.org_id = m.org_id and ci.due_at >= p_from and ci.due_at < p_to and office.can_client(m, ci.client_id)
    ) q(x)), '[]'));
end $$;

create or replace function office.act_calendar(m office.memberships, a text, p jsonb) returns jsonb language plpgsql security definer set search_path = office, public as $$
declare v_id uuid; mt office.meetings; t office.todos;
begin
  if a not in ('meeting_save','meeting_cancel','todo_save','todo_set') then return '"__nohandle"'::jsonb; end if;
  if nullif(p->>'client_id','') is not null and not office.can_client(m, (p->>'client_id')::uuid) then raise exception 'forbidden:client'; end if;
  if a = 'meeting_save' then
    if coalesce(trim(p->>'title'),'') = '' then raise exception 'missing:title'; end if;
    if (p->>'starts_at') is null then raise exception 'missing:starts_at'; end if;
    if nullif(p->>'id','') is null then
      insert into office.meetings(org_id, client_id, title, starts_at, ends_at, location, attendees, status, description, all_day, created_by, source, sync_state)
      values (m.org_id, nullif(p->>'client_id','')::uuid, trim(p->>'title'), (p->>'starts_at')::timestamptz, coalesce(nullif(p->>'ends_at','')::timestamptz, (p->>'starts_at')::timestamptz + interval '1 hour'),
        nullif(p->>'location',''), coalesce(p->'attendees','[]'), 'scheduled', nullif(p->>'description',''), coalesce((p->>'all_day')::boolean,false), m.user_id, 'office', 'pending') returning id into v_id;
    else
      update office.meetings set title = trim(p->>'title'), starts_at = (p->>'starts_at')::timestamptz, ends_at = coalesce(nullif(p->>'ends_at','')::timestamptz, (p->>'starts_at')::timestamptz + interval '1 hour'),
        location = nullif(p->>'location',''), client_id = nullif(p->>'client_id','')::uuid, attendees = coalesce(p->'attendees', attendees), description = nullif(p->>'description',''),
        all_day = coalesce((p->>'all_day')::boolean, all_day), sync_state = 'pending', updated_at = now() where id = (p->>'id')::uuid and org_id = m.org_id returning id into v_id;
      if v_id is null then raise exception 'not_found'; end if;
    end if;
    return jsonb_build_object('id', v_id);
  elsif a = 'meeting_cancel' then
    update office.meetings set status = 'cancelled', sync_state = 'pending', updated_at = now() where id = (p->>'id')::uuid and org_id = m.org_id returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
    return jsonb_build_object('ok', true);
  elsif a = 'todo_save' then
    if coalesce(trim(p->>'title'),'') = '' then raise exception 'missing:title'; end if;
    if nullif(p->>'id','') is null then
      insert into office.todos(org_id, title, notes, due_at, all_day, client_id, priority, created_by, assignee)
      values (m.org_id, trim(p->>'title'), nullif(p->>'notes',''), nullif(p->>'due_at','')::timestamptz, coalesce((p->>'all_day')::boolean,true), nullif(p->>'client_id','')::uuid, coalesce(nullif(p->>'priority',''),'normal'), m.user_id, m.user_id) returning id into v_id;
    else
      update office.todos set title = trim(p->>'title'), notes = nullif(p->>'notes',''), due_at = nullif(p->>'due_at','')::timestamptz, all_day = coalesce((p->>'all_day')::boolean, all_day),
        client_id = nullif(p->>'client_id','')::uuid, priority = coalesce(nullif(p->>'priority',''), priority), updated_at = now() where id = (p->>'id')::uuid and org_id = m.org_id returning id into v_id;
      if v_id is null then raise exception 'not_found'; end if;
    end if;
    return jsonb_build_object('id', v_id);
  else
    update office.todos set status = p->>'status', done_at = case when p->>'status' = 'done' then now() end, updated_at = now() where id = (p->>'id')::uuid and org_id = m.org_id and p->>'status' in ('open','done','cancelled') returning id into v_id;
    if v_id is null then raise exception 'not_found'; end if;
    return jsonb_build_object('ok', true);
  end if;
end $$;

-- worker side: Google tokens and sync
create or replace function public.office_worker_oauth_save(p_secret text, p_provider text, p_account text, p_token_enc text, p_scopes text) returns void language plpgsql security definer set search_path = office, public as $$
declare v_org uuid;
begin
  v_org := office.worker_org(p_secret);
  insert into office.oauth_tokens(org_id, provider, account_email, token_enc, scopes) values (v_org, p_provider, p_account, p_token_enc, p_scopes)
  on conflict (org_id, provider) do update set account_email = excluded.account_email, token_enc = excluded.token_enc, scopes = excluded.scopes, last_error = null, updated_at = now();
  insert into office.connections(org_id, provider, label, account_identifier, access_method, office_scope, status, verified_at, notes)
  select v_org, p_provider, 'Google Calendar', p_account, 'oauth', true, 'access_verified', now(), 'סנכרון יומן דו-כיווני'
  where not exists(select 1 from office.connections where org_id = v_org and provider = p_provider and disconnected_at is null);
  update office.connections set status = 'access_verified', verified_at = now(), account_identifier = p_account, last_error = null, updated_at = now() where org_id = v_org and provider = p_provider and disconnected_at is null;
end $$;

create or replace function public.office_worker_oauth_get(p_secret text, p_provider text) returns jsonb language plpgsql security definer set search_path = office, public as $$
declare v_org uuid;
begin
  v_org := office.worker_org(p_secret);
  return (select jsonb_build_object('token_enc', token_enc, 'account', account_email, 'calendar_id', calendar_id, 'last_sync_at', last_sync_at) from office.oauth_tokens where org_id = v_org and provider = p_provider);
end $$;

create or replace function public.office_worker_oauth_status(p_secret text, p_provider text, p_error text) returns void language plpgsql security definer set search_path = office, public as $$
declare v_org uuid;
begin
  v_org := office.worker_org(p_secret);
  update office.oauth_tokens set last_sync_at = case when p_error is null then now() else last_sync_at end, last_error = p_error, updated_at = now() where org_id = v_org and provider = p_provider;
  update office.connections set status = case when p_error is null then 'action_tested'::office.conn_status else 'expired'::office.conn_status end, last_error = p_error, verified_at = case when p_error is null then now() else verified_at end
   where org_id = v_org and provider = p_provider and disconnected_at is null;
end $$;

create or replace function public.office_worker_calendar_pending(p_secret text) returns jsonb language plpgsql security definer set search_path = office, public as $$
declare v_org uuid;
begin
  v_org := office.worker_org(p_secret);
  return coalesce((select jsonb_agg(jsonb_build_object('id', mt.id, 'title', mt.title, 'starts_at', mt.starts_at, 'ends_at', mt.ends_at, 'location', mt.location, 'description', concat_ws(E'\n', mt.description, case when c.name is not null then 'לקוח: ' || c.name end, 'PIXEL AI OFFICE'),
      'status', mt.status, 'external_event_id', mt.external_event_id, 'all_day', mt.all_day, 'attendees', mt.attendees))
    from (select * from office.meetings where org_id = v_org and sync_state = 'pending' and source = 'office' and starts_at > now() - interval '30 days' order by updated_at limit 25) mt
    left join office.clients c on c.id = mt.client_id), '[]');
end $$;

create or replace function public.office_worker_calendar_mark(p_secret text, p_id uuid, p_external text, p_state text, p_error text) returns void language plpgsql security definer set search_path = office, public as $$
declare v_org uuid;
begin
  v_org := office.worker_org(p_secret);
  update office.meetings set external_event_id = coalesce(p_external, external_event_id), sync_state = p_state, sync_error = p_error where id = p_id and org_id = v_org;
end $$;

-- pull from Google: insert/update events that are not ours; cancel the ones deleted in Google
create or replace function public.office_worker_calendar_pull(p_secret text, p_events jsonb) returns int language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; e jsonb; n int := 0; mt office.meetings;
begin
  v_org := office.worker_org(p_secret);
  for e in select * from jsonb_array_elements(coalesce(p_events,'[]')) loop
    select * into mt from office.meetings where org_id = v_org and external_event_id = e->>'id';
    if e->>'status' = 'cancelled' then
      if mt.id is not null and mt.status <> 'cancelled' then update office.meetings set status = 'cancelled', sync_state = 'synced' where id = mt.id; n := n + 1; end if;
      continue;
    end if;
    if mt.id is null then
      insert into office.meetings(org_id, title, starts_at, ends_at, location, description, status, source, sync_state, external_event_id, all_day, google_updated, attendees)
      values (v_org, coalesce(nullif(e->>'title',''),'(ללא כותרת)'), (e->>'start')::timestamptz, (e->>'end')::timestamptz, nullif(e->>'location',''), nullif(e->>'description',''), 'scheduled', 'google', 'synced', e->>'id',
        coalesce((e->>'all_day')::boolean,false), (e->>'updated')::timestamptz, coalesce(e->'attendees','[]')) on conflict do nothing;
      n := n + 1;
    elsif mt.sync_state <> 'pending' and (mt.google_updated is null or (e->>'updated')::timestamptz > mt.google_updated) then
      update office.meetings set title = coalesce(nullif(e->>'title',''), title), starts_at = (e->>'start')::timestamptz, ends_at = (e->>'end')::timestamptz, location = nullif(e->>'location',''),
        all_day = coalesce((e->>'all_day')::boolean, all_day), google_updated = (e->>'updated')::timestamptz, status = 'scheduled', sync_state = 'synced', updated_at = now() where id = mt.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.office_worker_calendar_feed(p_secret text) returns jsonb language plpgsql stable security definer set search_path = office, public as $$
declare v_org uuid;
begin
  v_org := office.worker_org(p_secret);
  return jsonb_build_object(
    'meetings', coalesce((select jsonb_agg(jsonb_build_object('id', mt.id, 'title', mt.title, 'start', mt.starts_at, 'end', mt.ends_at, 'location', mt.location, 'all_day', mt.all_day, 'client', c.name))
      from office.meetings mt left join office.clients c on c.id = mt.client_id where mt.org_id = v_org and mt.status <> 'cancelled' and mt.source = 'office' and mt.starts_at > now() - interval '60 days' and mt.starts_at < now() + interval '180 days'), '[]'),
    'todos', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'due', t.due_at, 'all_day', t.all_day)) from office.todos t where t.org_id = v_org and t.status = 'open' and t.due_at is not null), '[]'),
    'milestones', coalesce((select jsonb_agg(jsonb_build_object('id', ms.id, 'title', ms.title, 'date', ms.due_date, 'client', c.name)) from office.milestones ms join office.clients c on c.id = ms.client_id
      where ms.org_id = v_org and ms.status not in ('done','skipped') and ms.due_date > (now() - interval '14 days')::date and ms.due_date < (now() + interval '120 days')::date), '[]'));
end $$;

insert into office.action_permissions(action, roles, description) values
 ('meeting_save', '{owner,admin,account_manager,employee}', 'יצירה/עדכון פגישה'), ('meeting_cancel', '{owner,admin,account_manager,employee}', 'ביטול פגישה'),
 ('todo_save', '{owner,admin,account_manager,employee}', 'משימה ביומן'), ('todo_set', '{owner,admin,account_manager,employee}', 'סימון משימה')
on conflict (action) do update set roles = excluded.roles, description = excluded.description;

create or replace function public.office_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = office, public as $function$
declare m office.memberships; r jsonb; p jsonb := coalesce(p_payload,'{}'::jsonb);
begin
  m := office.ctx();
  perform office.require(m, p_action);
  r := office.act_crm(m, p_action, p);
  if r = '"__nohandle"'::jsonb then r := office.act_work(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_admin(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_billing(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_proposals(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_research(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_content(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_studio(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_journey(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_calendar(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then raise exception 'unknown_action:%', p_action; end if;
  return r;
end $function$;

revoke all on function public.office_calendar(timestamptz, timestamptz) from public, anon;
grant execute on function public.office_calendar(timestamptz, timestamptz) to authenticated;
revoke all on function public.office_worker_oauth_save(text, text, text, text, text), public.office_worker_oauth_get(text, text), public.office_worker_oauth_status(text, text, text),
  public.office_worker_calendar_pending(text), public.office_worker_calendar_mark(text, uuid, text, text, text), public.office_worker_calendar_pull(text, jsonb), public.office_worker_calendar_feed(text) from public;
grant execute on function public.office_worker_oauth_save(text, text, text, text, text), public.office_worker_oauth_get(text, text), public.office_worker_oauth_status(text, text, text),
  public.office_worker_calendar_pending(text), public.office_worker_calendar_mark(text, uuid, text, text, text), public.office_worker_calendar_pull(text, jsonb), public.office_worker_calendar_feed(text) to anon, authenticated, service_role;
