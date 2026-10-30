-- applied migration: office_0002_core_functions (version 20261030070257)
set check_function_bodies = off;
create table if not exists office.action_permissions (action text primary key, roles office.role[] not null, description text);
revoke all on office.action_permissions from public, anon, authenticated;
insert into office.action_permissions(action, roles, description) values
 ('create_client','{owner,admin,account_manager}','יצירת לקוח'),
 ('update_client','{owner,admin,account_manager}','עדכון תיק לקוח'),
 ('create_contact','{owner,admin,account_manager}','איש קשר'),
 ('verify_contact_phone','{owner,admin}','סימון מספר כמאומת'),
 ('create_project','{owner,admin,account_manager}','פרויקט/מותג'),
 ('create_asset','{owner,admin,account_manager}','רישום נכס (לא מעניק גישה)'),
 ('create_lead','{owner,admin,account_manager,employee}','יצירת ליד'),
 ('update_lead','{owner,admin,account_manager}','עדכון ליד'),
 ('update_brief','{owner,admin,account_manager}','עדכון בריף'),
 ('set_price','{owner}','קביעת/שינוי מחיר נעול — Owner בלבד'),
 ('set_terms_template','{owner}','תבנית מס ותנאים — Owner בלבד'),
 ('create_proposal','{owner,admin,account_manager}','פתיחת הצעה'),
 ('create_proposal_version','{owner,admin,account_manager}','גרסת הצעה'),
 ('approve_proposal','{owner}','אישור הצעה לשליחה'),
 ('mark_proposal_sent','{owner}','סימון שנשלחה'),
 ('confirm_engagement','{owner}','תיעוד התקשרות מאושרת'),
 ('activate_engagement','{owner}','הפעלת התקשרות לפי תנאי התחלה'),
 ('open_service_period','{owner,admin}','פתיחת תקופת שירות'),
 ('assign_task','{owner,admin,account_manager}','הקצאת משימה'),
 ('request_revision','{owner,admin,account_manager}','בקשת תיקון'),
 ('approve_artifact','{owner}','אישור תוצר'),
 ('create_request','{owner,admin,account_manager}','דבר עם המשרד'),
 ('cancel_run','{owner,admin}','ביטול ריצה'),
 ('pause_request','{owner,admin}','השהיית בקשה'),
 ('resume_request','{owner,admin}','חידוש בקשה'),
 ('retry_task','{owner,admin}','ניסיון חוזר מבוקר'),
 ('set_kill_switch','{owner,admin}','עצירה'),
 ('upsert_connection','{owner,admin}','הגדרת חיבור'),
 ('disconnect_connection','{owner,admin}','ניתוק חיבור'),
 ('upsert_automation','{owner,admin}','אוטומציה'),
 ('set_automation_status','{owner,admin}','הפעלה/השהיה'),
 ('agent_save_version','{owner,admin}','סטודיו סוכנים'),
 ('agent_set_status','{owner,admin}','השעיה/ארכוב'),
 ('agent_test_run','{owner,admin}','משימת ניסיון'),
 ('add_knowledge','{owner,admin,account_manager,employee}','ידע'),
 ('approve_knowledge','{owner,admin}','אישור ידע'),
 ('register_file','{owner,admin,account_manager,employee}','רישום קובץ'),
 ('create_meeting','{owner,admin,account_manager}','פגישה'),
 ('update_meeting','{owner,admin,account_manager}','עדכון פגישה'),
 ('add_calendar_marker','{owner,admin}','חג/אירוע'),
 ('create_content_item','{owner,admin,account_manager}','פריט תוכן'),
 ('move_content_item','{owner,admin,account_manager}','שינוי מועד'),
 ('prepare_message','{owner,admin,account_manager}','הכנת טיוטת הודעה (לא שליחה)'),
 ('draft_decision','{owner}','בקש ניסוח/שמור/בטל'),
 ('create_local_runner','{owner}','pairing ל-Local Runner'),
 ('revoke_local_runner','{owner}','ביטול Local Runner'),
 ('save_layout','{owner,admin,account_manager,employee,viewer}','מיקום דמויות'),
 ('rtm_decision','{owner,admin,account_manager}','החלטה על RTM/טרנד'),
 ('add_research_source','{owner,admin,account_manager}','מקור מחקר'),
 ('set_budget','{owner}','מגבלות עלות'),
 ('invite_member','{owner}','הוספת משתמש'),
 ('grant_client_access','{owner,admin}','גישה ללקוח'),
 ('import_clients','{owner,admin}','יבוא לקוחות')
on conflict (action) do update set roles = excluded.roles, description = excluded.description;

create or replace function office.ctx() returns office.memberships
language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into m from office.memberships where user_id = auth.uid() and active limit 1;
  if m.id is null then raise exception 'no_membership' using errcode = '42501'; end if;
  return m;
end $$;

create or replace function office.is_admin(m office.memberships) returns boolean
language sql immutable as $$ select m.role in ('owner','admin') $$;

create or replace function office.can_client(m office.memberships, p_client uuid) returns boolean
language sql stable security definer set search_path = office, public as $$
  select case
    when p_client is null then m.role in ('owner','admin')
    when m.role in ('owner','admin') then exists(select 1 from office.clients c where c.id = p_client and c.org_id = m.org_id)
    else exists(select 1 from office.client_access a where a.user_id = m.user_id and a.client_id = p_client and a.project_id is null)
  end $$;

create or replace function office.can_project(m office.memberships, p_client uuid, p_project uuid) returns boolean
language sql stable security definer set search_path = office, public as $$
  select case
    when m.role in ('owner','admin') then office.can_client(m, p_client)
    when p_project is null then office.can_client(m, p_client)
    else exists(select 1 from office.client_access a where a.user_id = m.user_id and a.client_id = p_client
                and (a.project_id is null or a.project_id = p_project))
  end $$;

create or replace function office.require(m office.memberships, p_action text) returns void
language plpgsql stable security definer set search_path = office, public as $$
begin
  if not exists(select 1 from office.action_permissions where action = p_action and m.role = any(roles)) then
    raise exception 'forbidden:%', p_action using errcode = '42501';
  end if;
end $$;

create or replace function office.audit(p_org uuid, p_actor_type text, p_actor text, p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb)
returns void language sql security definer set search_path = office, public as $$
  insert into office.audit_events(org_id, actor_type, actor_id, action, entity, entity_id, before, after)
  values (p_org, p_actor_type, p_actor, p_action, p_entity, p_entity_id, p_before, p_after) $$;

create or replace function office.emit(p_org uuid, p_kind text, p_message text, p_task uuid default null, p_wf uuid default null,
  p_req uuid default null, p_agent text default null, p_client uuid default null, p_payload jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = office, public as $$
  insert into office.task_events(org_id, kind, message, task_run_id, workflow_run_id, request_id, agent_id, client_id, payload)
  values (p_org, p_kind, p_message, p_task, p_wf, p_req, p_agent, p_client, coalesce(p_payload,'{}'::jsonb)) $$;

create or replace function office.check_secret(p_name text, p_value text) returns boolean
language sql stable security definer set search_path = office, public, extensions as $$
  select exists(select 1 from office.system_secrets s where s.name = p_name
                and s.sha256 = encode(extensions.digest(coalesce(p_value,''), 'sha256'), 'hex')) $$;

create or replace function office.worker_org(p_secret text) returns uuid
language plpgsql stable security definer set search_path = office, public as $$
declare o uuid;
begin
  if not office.check_secret('worker', p_secret) then raise exception 'bad_worker_secret' using errcode = '28000'; end if;
  select id into o from office.organizations order by created_at limit 1;
  return o;
end $$;

create or replace function public.office_bootstrap() returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_email text; v_allow office.owner_allowlist; m office.memberships; v_owner_exists boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into m from office.memberships where user_id = auth.uid() limit 1;
  if m.id is null then
    select lower(email) into v_email from auth.users where id = auth.uid();
    select * into v_allow from office.owner_allowlist where email = v_email;
    if v_allow.email is null then raise exception 'not_invited' using errcode = '42501'; end if;
    select exists(select 1 from office.memberships where org_id = v_allow.org_id and role = 'owner') into v_owner_exists;
    if v_allow.role = 'owner' and v_owner_exists then raise exception 'owner_already_set'; end if;
    insert into office.memberships(org_id, user_id, email, role) values (v_allow.org_id, auth.uid(), v_email, v_allow.role)
    returning * into m;
    perform office.audit(m.org_id, 'user', auth.uid()::text, 'bootstrap_membership', 'membership', m.id::text, null, to_jsonb(m));
  end if;
  return jsonb_build_object('user_id', m.user_id, 'email', m.email, 'role', m.role, 'org_id', m.org_id,
    'org', (select to_jsonb(o) - 'settings' from office.organizations o where o.id = m.org_id));
end $$;

create or replace function public.office_me() returns jsonb
language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships;
begin
  m := office.ctx();
  return jsonb_build_object('user_id', m.user_id, 'email', m.email, 'role', m.role, 'org_id', m.org_id,
    'permissions', (select coalesce(jsonb_agg(action), '[]'::jsonb) from office.action_permissions where m.role = any(roles)),
    'org', (select to_jsonb(o) from office.organizations o where o.id = m.org_id));
end $$;

create table if not exists office.read_entities (entity text primary key, table_name text not null, client_col text, project_col text, admin_only boolean not null default false, hidden_cols text[] not null default '{}', default_order text not null default 'created_at desc');
revoke all on office.read_entities from public, anon, authenticated;
insert into office.read_entities(entity, table_name, client_col, project_col, admin_only, hidden_cols, default_order) values
 ('clients','clients','id',null,false,'{}','name asc'),
 ('contacts','contacts','client_id',null,false,'{}','name asc'),
 ('projects','projects','client_id','id',false,'{}','name asc'),
 ('client_assets','client_assets','client_id','project_id',false,'{}','created_at desc'),
 ('leads','leads','client_id',null,true,'{}','created_at desc'),
 ('briefs','briefs','client_id','project_id',true,'{}','created_at desc'),
 ('proposals','proposals','client_id',null,true,'{share_token_hash}','created_at desc'),
 ('proposal_versions','proposal_versions',null,null,true,'{}','version_no desc'),
 ('proposal_items','proposal_items',null,null,true,'{}','sort asc'),
 ('terms_templates','terms_templates',null,null,true,'{}','created_at desc'),
 ('engagements','engagements','client_id',null,true,'{}','created_at desc'),
 ('service_entitlements','service_entitlements',null,null,true,'{}','title asc'),
 ('service_periods','service_periods','client_id',null,false,'{}','period_start desc'),
 ('content_items','content_items','client_id','project_id',false,'{}','due_at asc nulls last'),
 ('artifacts','artifacts','client_id','project_id',false,'{}','updated_at desc'),
 ('agent_definitions','agent_definitions',null,null,false,'{}','number asc'),
 ('agent_versions','agent_versions',null,null,false,'{}','version_no desc'),
 ('requests','requests','client_id','project_id',false,'{}','created_at desc'),
 ('workflow_runs','workflow_runs','client_id','project_id',false,'{}','created_at desc'),
 ('task_runs','task_runs','client_id','project_id',false,'{lease_token}','updated_at desc'),
 ('connections','connections',null,null,true,'{secret_ref}','provider asc'),
 ('connection_capabilities','connection_capabilities',null,null,true,'{}','capability asc'),
 ('connection_checks','connection_checks',null,null,true,'{}','checked_at desc'),
 ('provider_jobs','provider_jobs',null,null,true,'{}','created_at desc'),
 ('conversations','conversations','client_id',null,true,'{}','created_at desc'),
 ('messages','messages',null,null,true,'{}','occurred_at desc'),
 ('message_drafts','message_drafts','client_id','project_id',true,'{}','created_at desc'),
 ('meetings','meetings','client_id',null,false,'{}','starts_at asc'),
 ('calendar_markers','calendar_markers',null,null,false,'{}','date asc'),
 ('rtm_items','rtm_items','client_id',null,false,'{}','created_at desc'),
 ('trend_items','trend_items','client_id',null,false,'{}','created_at desc'),
 ('research_sources','research_sources','client_id',null,false,'{}','created_at desc'),
 ('ad_accounts','ad_accounts','client_id','project_id',true,'{}','created_at desc'),
 ('metric_snapshots','metric_snapshots','client_id',null,true,'{}','pulled_at desc'),
 ('campaign_change_log','campaign_change_log',null,null,true,'{}','created_at desc'),
 ('knowledge_items','knowledge_items','client_id','project_id',false,'{tsv}','updated_at desc'),
 ('files','files','client_id','project_id',false,'{}','created_at desc'),
 ('automations','automations',null,null,true,'{}','created_at desc'),
 ('usage_entries','usage_entries','client_id','project_id',true,'{}','created_at desc'),
 ('budgets','budgets',null,null,true,'{}','scope_type asc'),
 ('audit_events','audit_events',null,null,true,'{}','created_at desc'),
 ('local_runners','local_runners',null,null,true,'{pairing_code_hash,token_hash}','created_at desc'),
 ('kill_switches','kill_switches',null,null,true,'{}','set_at desc'),
 ('memberships','memberships',null,null,true,'{}','created_at asc'),
 ('quota_allocations','quota_allocations',null,null,true,'{}','created_at desc'),
 ('reviews','reviews',null,null,false,'{}','decided_at desc'),
 ('worker_heartbeats','worker_heartbeats',null,null,true,'{}','last_seen desc')
on conflict (entity) do update set table_name=excluded.table_name, client_col=excluded.client_col, project_col=excluded.project_col, admin_only=excluded.admin_only, hidden_cols=excluded.hidden_cols, default_order=excluded.default_order;

create or replace function office.child_scope_sql(p_entity text) returns text language sql immutable as $$
  select case p_entity
    when 'proposal_versions' then 'exists(select 1 from office.proposals p where p.id = t.proposal_id and p.org_id = $1)'
    when 'proposal_items' then 'exists(select 1 from office.proposal_versions v join office.proposals p on p.id=v.proposal_id where v.id = t.proposal_version_id and p.org_id = $1)'
    when 'service_entitlements' then 't.org_id = $1'
    when 'agent_versions' then 'exists(select 1 from office.agent_definitions a where a.id = t.agent_id and a.org_id = $1)'
    when 'connection_capabilities' then 'exists(select 1 from office.connections c where c.id = t.connection_id and c.org_id = $1)'
    when 'connection_checks' then 'exists(select 1 from office.connections c where c.id = t.connection_id and c.org_id = $1)'
    when 'messages' then 'exists(select 1 from office.conversations c where c.id = t.conversation_id and c.org_id = $1)'
    when 'quota_allocations' then 'exists(select 1 from office.service_periods s where s.id = t.period_id and s.org_id = $1)'
    when 'reviews' then 'exists(select 1 from office.artifact_versions v join office.artifacts a on a.id=v.artifact_id where v.id=t.artifact_version_id and a.org_id=$1 and office.can_client($2, a.client_id))'
    when 'worker_heartbeats' then 'true'
    else 't.org_id = $1' end $$;

create or replace function public.office_list(p_entity text, p_filters jsonb default '{}'::jsonb, p_limit int default 200, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships; e office.read_entities; v_sql text; v_where text := ''; k text; v jsonb; res jsonb; v_cols text;
begin
  m := office.ctx();
  select * into e from office.read_entities where entity = p_entity;
  if e.entity is null then raise exception 'unknown_entity:%', p_entity; end if;
  if e.admin_only and m.role not in ('owner','admin') then
    if not (m.role = 'account_manager' and e.client_col is not null) then raise exception 'forbidden:%', p_entity using errcode='42501'; end if;
  end if;
  for k, v in select * from jsonb_each(coalesce(p_filters,'{}'::jsonb)) loop
    if k = '_search' then
      if p_entity = 'knowledge_items' then v_where := v_where || format(' and t.tsv @@ plainto_tsquery(''simple'', %L)', v #>> '{}');
      elsif exists(select 1 from information_schema.columns where table_schema='office' and table_name=e.table_name and column_name='name') then
        v_where := v_where || format(' and t.name ilike %L', '%'||(v #>> '{}')||'%');
      elsif exists(select 1 from information_schema.columns where table_schema='office' and table_name=e.table_name and column_name='title') then
        v_where := v_where || format(' and t.title ilike %L', '%'||(v #>> '{}')||'%');
      end if;
      continue;
    end if;
    if k = '_active' then v_where := v_where || ' and t.archived_at is null'; continue; end if;
    if not exists(select 1 from information_schema.columns where table_schema='office' and table_name=e.table_name and column_name=k) then
      raise exception 'bad_filter:%', k;
    end if;
    if jsonb_typeof(v) = 'array' then
      v_where := v_where || format(' and t.%I::text in (select jsonb_array_elements_text(%L::jsonb))', k, v::text);
    elsif jsonb_typeof(v) = 'null' then
      v_where := v_where || format(' and t.%I is null', k);
    else
      v_where := v_where || format(' and t.%I::text = %L', k, v #>> '{}');
    end if;
  end loop;
  if e.client_col is not null then
    if e.project_col is not null and e.project_col <> 'id' then
      v_where := v_where || format(' and (t.%I is null and ($2).role in (''owner'',''admin'') or t.%I is not null and office.can_project($2, t.%I, t.%I))', e.client_col, e.client_col, e.client_col, e.project_col);
    elsif e.project_col = 'id' then
      v_where := v_where || format(' and office.can_project($2, t.%I, t.id)', e.client_col);
    else
      v_where := v_where || format(' and (t.%I is null and ($2).role in (''owner'',''admin'') or t.%I is not null and office.can_client($2, t.%I))', e.client_col, e.client_col, e.client_col);
    end if;
  elsif m.role not in ('owner','admin') and p_entity not in ('agent_definitions','agent_versions','calendar_markers','reviews') then
    raise exception 'forbidden:%', p_entity using errcode='42501';
  end if;
  select string_agg(quote_ident(column_name), ',' order by ordinal_position) into v_cols
    from information_schema.columns where table_schema='office' and table_name=e.table_name and not (column_name = any(e.hidden_cols));
  v_sql := format('select coalesce(jsonb_agg(r), ''[]''::jsonb) from (select %s from office.%I t where %s %s order by %s limit %s offset %s) r',
    (select string_agg('t.'||c, ',') from unnest(string_to_array(v_cols, ',')) c), e.table_name, office.child_scope_sql(p_entity), v_where,
    regexp_replace(e.default_order, '^([a-z_]+)', 't.\1'), least(greatest(p_limit,1),1000), greatest(p_offset,0));
  execute v_sql into res using m.org_id, m;
  return res;
end $$;

create or replace function public.office_get(p_entity text, p_id text) returns jsonb
language plpgsql stable security definer set search_path = office, public as $$
declare r jsonb;
begin
  r := public.office_list(p_entity, jsonb_build_object('id', p_id), 1, 0);
  if jsonb_array_length(r) = 0 then return null; end if;
  return r->0;
end $$;

create or replace function public.office_events_since(p_after bigint default 0, p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships;
begin
  m := office.ctx();
  return (select coalesce(jsonb_agg(e order by e.id), '[]'::jsonb) from (
    select ev.id, ev.kind, ev.message, ev.task_run_id, ev.workflow_run_id, ev.request_id, ev.agent_id, ev.client_id, ev.created_at
    from office.task_events ev
    where ev.org_id = m.org_id and ev.id > coalesce(p_after,0)
      and (ev.client_id is null and m.role in ('owner','admin') or ev.client_id is not null and office.can_client(m, ev.client_id))
    order by ev.id limit least(p_limit, 500)) e);
end $$;

grant execute on function public.office_bootstrap() to authenticated;
grant execute on function public.office_me() to authenticated;
grant execute on function public.office_list(text, jsonb, int, int) to authenticated;
grant execute on function public.office_get(text, text) to authenticated;
grant execute on function public.office_events_since(bigint, int) to authenticated;
revoke execute on function public.office_bootstrap() from anon, public;
revoke execute on function public.office_me() from anon, public;
revoke execute on function public.office_list(text, jsonb, int, int) from anon, public;
revoke execute on function public.office_get(text, text) from anon, public;
revoke execute on function public.office_events_since(bigint, int) from anon, public;
