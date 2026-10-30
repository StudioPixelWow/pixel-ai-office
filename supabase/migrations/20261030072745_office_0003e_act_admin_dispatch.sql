-- applied migration: office_0003e_act_admin_dispatch (version 20261030072745)
create or replace function office.act_admin(m office.memberships, p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path = office, public, extensions as $$
declare r jsonb := '{}'::jsonb; v_id uuid; v_client uuid; v_text text; v_n int; v_req uuid; v_wf uuid; v_tok text; rec record;
begin
  case p_action
  when 'upsert_connection' then
    if p ? 'id' then
      update office.connections set label = coalesce(p->>'label',label), notes = coalesce(p->>'notes', notes),
        allowed_client_ids = case when p ? 'allowed_client_ids' then array(select jsonb_array_elements_text(p->'allowed_client_ids'))::uuid[] else allowed_client_ids end,
        office_scope = coalesce((p->>'office_scope')::boolean, office_scope),
        status = case when p ? 'account_identifier' and (p->>'account_identifier') is distinct from account_identifier then 'pending_setup' else status end,
        account_identifier = coalesce(p->>'account_identifier', account_identifier), updated_at = now()
      where id = (p->>'id')::uuid and org_id = m.org_id returning id into v_id;
      if p ? 'account_identifier' then update office.connection_capabilities set status = 'pending_setup', verified_at = null where connection_id = v_id and implemented; end if;
    else
      insert into office.connections(org_id, provider, label, account_identifier, owner_user, access_method, allowed_client_ids, office_scope, secret_ref, notes, status)
      values (m.org_id, p->>'provider', p->>'label', p->>'account_identifier', m.user_id, p->>'access_method',
        case when p ? 'allowed_client_ids' then array(select jsonb_array_elements_text(p->'allowed_client_ids'))::uuid[] end,
        coalesce((p->>'office_scope')::boolean,false), p->>'secret_ref', p->>'notes', 'pending_setup') returning id into v_id;
      insert into office.connection_capabilities(connection_id, capability, implemented, status, permission_required, check_method)
      select v_id, c->>'capability', coalesce((c->>'implemented')::boolean,false),
             case when coalesce((c->>'implemented')::boolean,false) then 'pending_setup'::office.conn_status else 'not_implemented'::office.conn_status end,
             c->>'permission_required', c->>'check_method'
      from jsonb_array_elements(coalesce(p->'capabilities','[]'::jsonb)) c on conflict do nothing;
    end if;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'connection',v_id::text,null,p);
    r := jsonb_build_object('id', v_id);
  when 'disconnect_connection' then
    update office.connections set status = 'not_connected', disconnected_at = now(), updated_at = now() where id = (p->>'id')::uuid and org_id = m.org_id;
    update office.connection_capabilities set status = 'not_connected' where connection_id = (p->>'id')::uuid;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'connection',p->>'id',null,null);
  when 'upsert_automation' then
    if p ? 'id' then
      update office.automations set name = coalesce(p->>'name',name), schedule_kind = coalesce(p->>'schedule_kind',schedule_kind),
        schedule_day = coalesce(nullif(p->>'schedule_day','')::int, schedule_day), schedule_weekday = coalesce(nullif(p->>'schedule_weekday','')::int, schedule_weekday),
        schedule_time = coalesce(nullif(p->>'schedule_time','')::time, schedule_time), event_key = coalesce(p->>'event_key', event_key),
        client_scope = coalesce(p->>'client_scope', client_scope), params = coalesce(p->'params', params), limits = coalesce(p->'limits', limits),
        workflow_key = coalesce(p->>'workflow_key', workflow_key), updated_at = now()
      where id = (p->>'id')::uuid and org_id = m.org_id returning id into v_id;
    else
      insert into office.automations(org_id, name, trigger_type, schedule_kind, schedule_day, schedule_weekday, schedule_time, event_key, client_scope, client_ids, workflow_key, params, limits, status, created_by)
      values (m.org_id, p->>'name', p->>'trigger_type', p->>'schedule_kind', nullif(p->>'schedule_day','')::int, nullif(p->>'schedule_weekday','')::int, nullif(p->>'schedule_time','')::time,
        p->>'event_key', coalesce(p->>'client_scope','all_active'), case when p ? 'client_ids' then array(select jsonb_array_elements_text(p->'client_ids'))::uuid[] end,
        coalesce(p->>'workflow_key','monthly_plan_client'), coalesce(p->'params','{}'::jsonb), coalesce(p->'limits','{"max_tasks":60,"max_cost_usd":15}'::jsonb), 'paused', m.user_id) returning id into v_id;
    end if;
    update office.automations a set next_run_at = office.automation_next_run(a) where a.id = v_id;
    r := jsonb_build_object('id', v_id);
  when 'set_automation_status' then
    update office.automations set status = p->>'status', updated_at = now() where id = (p->>'id')::uuid and org_id = m.org_id;
    update office.automations a set next_run_at = office.automation_next_run(a) where a.id = (p->>'id')::uuid;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'automation',p->>'id',null,p);
  when 'agent_save_version' then
    v_text := coalesce(nullif(p->>'agent_id',''), 'custom_'||substr(md5(random()::text),1,8));
    if not exists(select 1 from office.agent_definitions where id = v_text) then
      insert into office.agent_definitions(id, org_id, number, name, role_title, department, avatar_key, status, current_version, human_owner)
      values (v_text, m.org_id, (select coalesce(max(number),40)+1 from office.agent_definitions), p->>'name', p->>'role_title', coalesce(p->>'department','custom'),
              coalesce(p->>'avatar_key','custom'), 'testing', 0, m.user_id);
    end if;
    update office.agent_definitions set current_version = (select coalesce(max(version_no),0)+1 from office.agent_versions where agent_id = v_text),
      name = coalesce(p->>'name',name), role_title = coalesce(p->>'role_title', role_title), department = coalesce(p->>'department', department), updated_at = now()
      where id = v_text returning current_version into v_n;
    insert into office.agent_versions(agent_id, version_no, spec, instructions, preferred_model, tools, required_capabilities, triggers, limits, eval_tasks, change_note, created_by)
    values (v_text, v_n, coalesce(p->'spec','{}'::jsonb), coalesce(p->>'instructions',''), coalesce(nullif(p->>'preferred_model',''),'claude-opus-5-5'),
      coalesce(array(select jsonb_array_elements_text(coalesce(p->'tools','[]'))),'{}'), coalesce(array(select jsonb_array_elements_text(coalesce(p->'required_capabilities','["generate_text"]'))),'{generate_text}'),
      coalesce(p->'triggers','[]'::jsonb), coalesce(p->'limits','{}'::jsonb), coalesce(p->'eval_tasks','[]'::jsonb), p->>'change_note', m.user_id);
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'agent',v_text,null,jsonb_build_object('version',v_n));
    r := jsonb_build_object('agent_id', v_text, 'version_no', v_n);
  when 'agent_set_status' then
    if nullif(p->>'rollback_to','') is not null and not exists(select 1 from office.agent_versions where agent_id = p->>'agent_id' and version_no = (p->>'rollback_to')::int) then
      raise exception 'version_not_found'; end if;
    update office.agent_definitions set status = coalesce(nullif(p->>'status',''), status), updated_at = now(),
      current_version = coalesce(nullif(p->>'rollback_to','')::int, current_version) where id = p->>'agent_id' and org_id = m.org_id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'agent',p->>'agent_id',null,p);
  when 'agent_test_run' then
    insert into office.requests(org_id, source, mode, text, scope, status, created_by) values (m.org_id, 'manual', 'work', 'משימת ניסיון: '||coalesce(p->>'task',''), 'pixel', 'running', m.user_id) returning id into v_req;
    v_wf := office.instantiate_workflow(m.org_id, v_req, 'agent_trial', nullif(p->>'client_id','')::uuid, null,
      jsonb_build_object('instruction', p->>'task', 'criteria', p->'criteria', 'trial', true), 'trial:'||v_req, null, p->>'agent_id', 'ניסיון');
    r := jsonb_build_object('request_id', v_req, 'workflow_run_id', v_wf);
  when 'add_knowledge' then
    if nullif(p->>'client_id','') is not null and not office.can_client(m, (p->>'client_id')::uuid) then raise exception 'forbidden:client'; end if;
    insert into office.knowledge_items(org_id, scope, department, client_id, project_id, kind, title, body, source_url, valid_until, owner_user, approval_status)
    values (m.org_id, coalesce(nullif(p->>'scope',''), case when nullif(p->>'client_id','') is not null then 'client' else 'pixel' end), p->>'department', nullif(p->>'client_id','')::uuid, nullif(p->>'project_id','')::uuid,
      coalesce(p->>'kind','note'), p->>'title', p->>'body', p->>'source_url', nullif(p->>'valid_until','')::date, m.user_id,
      case when m.role in ('owner','admin') then 'approved' else 'pending' end) returning id into v_id;
    r := jsonb_build_object('id', v_id);
  when 'approve_knowledge' then
    update office.knowledge_items set approval_status = coalesce(p->>'status','approved'), updated_at = now() where id = (p->>'id')::uuid and org_id = m.org_id;
  when 'register_file' then
    if nullif(p->>'client_id','') is not null and not office.can_client(m, (p->>'client_id')::uuid) then raise exception 'forbidden:client'; end if;
    select id into v_id from office.files where org_id = m.org_id and sha256 = p->>'sha256' and coalesce(client_id::text,'') = coalesce(p->>'client_id','') and archived_at is null limit 1;
    if v_id is not null then return jsonb_build_object('duplicate', true, 'id', v_id); end if;
    insert into office.files(org_id, client_id, project_id, storage_path, file_name, mime, size_bytes, sha256, kind, approved_for_use, source_url, uploaded_by)
    values (m.org_id, nullif(p->>'client_id','')::uuid, nullif(p->>'project_id','')::uuid, p->>'storage_path', p->>'file_name', p->>'mime', (p->>'size_bytes')::bigint,
      p->>'sha256', p->>'kind', coalesce((p->>'approved_for_use')::boolean,false), p->>'source_url', m.user_id) returning id into v_id;
    r := jsonb_build_object('id', v_id);
  when 'create_meeting' then
    if nullif(p->>'client_id','') is not null and not office.can_client(m, (p->>'client_id')::uuid) then raise exception 'forbidden:client'; end if;
    insert into office.meetings(org_id, client_id, lead_id, title, starts_at, ends_at, location, attendees, prep_notes)
    values (m.org_id, nullif(p->>'client_id','')::uuid, nullif(p->>'lead_id','')::uuid, p->>'title', (p->>'starts_at')::timestamptz, (p->>'ends_at')::timestamptz,
      p->>'location', coalesce(p->'attendees','[]'::jsonb), p->>'prep_notes') returning id into v_id;
    r := jsonb_build_object('id', v_id, 'conflicts', (select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'starts_at',x.starts_at)),'[]'::jsonb)
      from office.meetings x where x.org_id = m.org_id and x.id <> v_id and x.status <> 'cancelled'
      and tstzrange(x.starts_at, x.ends_at) && tstzrange((p->>'starts_at')::timestamptz, (p->>'ends_at')::timestamptz)));
  when 'update_meeting' then
    update office.meetings set status = coalesce(p->>'status',status), starts_at = coalesce(nullif(p->>'starts_at','')::timestamptz, starts_at),
      ends_at = coalesce(nullif(p->>'ends_at','')::timestamptz, ends_at), updated_at = now() where id = (p->>'id')::uuid and org_id = m.org_id;
    if p->>'status' = 'cancelled' then
      update office.message_drafts set status = 'needs_review', review_reason = 'הפגישה בוטלה' where business_ref_id = (p->>'id')::uuid and status in ('pending_approval','draft','saved_later');
    end if;
  when 'add_calendar_marker' then
    insert into office.calendar_markers(org_id, date, title, kind, source) values (m.org_id, (p->>'date')::date, p->>'title', coalesce(p->>'kind','holiday'), coalesce(nullif(p->>'source',''),'manual')) on conflict do nothing;
  when 'rtm_decision' then
    if p->>'type' = 'rtm' then update office.rtm_items set status = p->>'status' where id = (p->>'id')::uuid and org_id = m.org_id returning client_id into v_client;
    else update office.trend_items set status = p->>'status' where id = (p->>'id')::uuid and org_id = m.org_id returning client_id into v_client; end if;
    if p->>'status' = 'accepted' and v_client is not null then
      insert into office.content_items(org_id, client_id, topic, brief, is_addon, production_status) values (m.org_id, v_client, p->>'topic', p->>'brief', true, 'planned') returning id into v_id;
      r := jsonb_build_object('content_item_id', v_id, 'note', 'נפתח פריט תוכן מסומן כתוספת להחלטתך (מחוץ למכסה עד שתשייך).');
    end if;
  when 'add_research_source' then
    insert into office.research_sources(org_id, client_id, kind, value, language) values (m.org_id, nullif(p->>'client_id','')::uuid, p->>'kind', p->>'value', coalesce(p->>'language','he'));
  when 'save_layout' then
    insert into office.ui_layout(user_id, key, value) values (m.user_id, p->>'key', p->'value') on conflict (user_id, key) do update set value = excluded.value;
  when 'set_budget' then
    insert into office.budgets(org_id, scope_type, scope_ref, monthly_limit_usd, hard_stop) values (m.org_id, p->>'scope_type', p->>'scope_ref', (p->>'monthly_limit_usd')::numeric, coalesce((p->>'hard_stop')::boolean,true))
    on conflict (org_id, scope_type, scope_ref) do update set monthly_limit_usd = excluded.monthly_limit_usd, hard_stop = excluded.hard_stop;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'budget',p->>'scope_ref',null,p);
  when 'set_test_numbers' then
    update office.organizations set settings = settings || jsonb_build_object('test_numbers', coalesce(p->'numbers','[]'::jsonb)) where id = m.org_id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'organization',m.org_id::text,null,p);
  when 'invite_member' then
    if (p->>'role') = 'owner' then raise exception 'owner_role_cannot_be_invited'; end if;
    insert into office.owner_allowlist(email, role, org_id) values (lower(p->>'email'), (p->>'role')::office.role, m.org_id) on conflict (email) do update set role = excluded.role;
  when 'grant_client_access' then
    insert into office.client_access(org_id, user_id, client_id, project_id) values (m.org_id, (p->>'user_id')::uuid, (p->>'client_id')::uuid, nullif(p->>'project_id','')::uuid) on conflict do nothing;
  when 'create_local_runner' then
    v_tok := upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,8));
    insert into office.local_runners(org_id, name, pairing_code_hash, pairing_expires_at, capabilities, allowed_sites)
    values (m.org_id, coalesce(p->>'name','Mac'), encode(extensions.digest(v_tok,'sha256'),'hex'), now() + interval '15 minutes',
      coalesce(array(select jsonb_array_elements_text(coalesce(p->'capabilities','["ffmpeg"]'))),'{ffmpeg}'), coalesce(array(select jsonb_array_elements_text(coalesce(p->'allowed_sites','[]'))),'{}')) returning id into v_id;
    r := jsonb_build_object('id', v_id, 'pairing_code', v_tok, 'expires_in_minutes', 15);
  when 'revoke_local_runner' then
    update office.local_runners set revoked_at = now(), token_hash = null where id = (p->>'id')::uuid and org_id = m.org_id;
    update office.task_runs set status = 'waiting_local', blocker = 'ה-Local Runner נותק', lease_token = null, updated_at = now() where org_id = m.org_id and status = 'running' and inputs->>'kind' like 'local:%';
  when 'import_clients' then
    v_n := 0;
    for rec in select x.j from jsonb_array_elements(coalesce(p->'rows','[]'::jsonb)) as x(j) loop
      if not exists(select 1 from office.clients where org_id = m.org_id and lower(name) = lower(rec.j->>'name') and archived_at is null) then
        insert into office.clients(org_id, name, industry, department, status, profile, import_source, created_by)
        values (m.org_id, rec.j->>'name', rec.j->>'industry', coalesce(rec.j->>'department','pixel_digital'), coalesce(rec.j->>'status','onboarding'), coalesce(rec.j->'profile','{}'::jsonb), coalesce(p->>'source','import'), m.user_id);
        v_n := v_n + 1;
      end if;
    end loop;
    r := jsonb_build_object('created', v_n, 'skipped_duplicates', jsonb_array_length(coalesce(p->'rows','[]'::jsonb)) - v_n);
  else
    return '"__nohandle"'::jsonb;
  end case;
  return r;
end $$;
insert into office.action_permissions(action, roles, description) values ('set_test_numbers','{owner}','מספרי בדיקה מאושרים לוואטסאפ') on conflict do nothing;

create or replace function public.office_action(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare m office.memberships; r jsonb; p jsonb := coalesce(p_payload,'{}'::jsonb);
begin
  m := office.ctx();
  perform office.require(m, p_action);
  r := office.act_crm(m, p_action, p);
  if r = '"__nohandle"'::jsonb then r := office.act_work(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_admin(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then raise exception 'unknown_action:%', p_action; end if;
  return r;
end $$;
revoke execute on function public.office_action(text, jsonb) from anon, public;
grant execute on function public.office_action(text, jsonb) to authenticated;
