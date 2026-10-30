-- applied migration: office_0004a_routing_reads (version 20261030072906)
create or replace function office.automation_next_run(a office.automations) returns timestamptz
language plpgsql stable set search_path = office, public as $$
declare tz text := coalesce(a.timezone,'Asia/Jerusalem'); lnow timestamp := (now() at time zone tz); cand timestamp; t time := coalesce(a.schedule_time, '08:30');
begin
  if a.status <> 'active' or a.trigger_type <> 'schedule' then return null; end if;
  if a.schedule_kind = 'daily' then
    cand := date_trunc('day', lnow) + t; if cand <= lnow then cand := cand + interval '1 day'; end if;
  elsif a.schedule_kind = 'weekly' then
    cand := date_trunc('day', lnow) + t + ((coalesce(a.schedule_weekday,0) - extract(dow from lnow)::int + 7) % 7) * interval '1 day';
    if cand <= lnow then cand := cand + interval '7 days'; end if;
  else
    cand := date_trunc('month', lnow) + (greatest(coalesce(a.schedule_day,1),1) - 1) * interval '1 day' + t;
    if cand <= lnow then cand := date_trunc('month', lnow) + interval '1 month' + (greatest(coalesce(a.schedule_day,1),1) - 1) * interval '1 day' + t; end if;
  end if;
  return cand at time zone tz;
end $$;

create or replace function office.next_month_start(p_tz text default 'Asia/Jerusalem') returns date language sql stable as $$
  select (date_trunc('month', now() at time zone p_tz) + interval '1 month')::date $$;

create or replace function office.route_request(p_req uuid) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare q office.requests; t text; r jsonb := '[]'::jsonb; c record; v_wf uuid; v_month date; v_ans text; v_n int := 0; v_eng uuid;
begin
  select * into q from office.requests where id = p_req;
  t := lower(q.text);
  v_month := coalesce((q.plan->>'month')::date, office.next_month_start());
  if q.mode = 'answer' or t ~ '(מה תקוע|ממתין להחלטה|ממתין לאישור שלי|מה מחכה לי)' then
    select string_agg(x, E'\n') into v_ans from (
      select '• ' || tr.title || ' — ' || coalesce(cl.name,'Pixel') || ' — ' ||
        case tr.status when 'waiting_approval' then 'ממתין לאישור שלך' when 'waiting_connection' then 'חסר חיבור: '||coalesce(tr.blocker,'')
          when 'waiting_input' then 'חסר חומר/החלטה: '||coalesce(tr.blocker,'') when 'waiting_local' then 'ממתין למחשב המקומי'
          when 'failed' then 'נכשל: '||coalesce(tr.blocker,'') when 'uncertain' then 'מצב לא ודאי — לבדיקה' end as x
      from office.task_runs tr left join office.clients cl on cl.id = tr.client_id
      where tr.org_id = q.org_id and tr.status in ('waiting_approval','waiting_connection','waiting_input','waiting_local','failed','uncertain')
        and (q.client_id is null or tr.client_id = q.client_id)
      order by tr.updated_at desc limit 40) s;
    select count(*) into v_n from office.message_drafts where org_id = q.org_id and status in ('pending_approval','needs_review') and (q.client_id is null or client_id = q.client_id);
    v_ans := coalesce(v_ans, 'אין כרגע משימות תקועות.') || E'\n\nהודעות שממתינות לאישורך במרכז האישורים: ' || v_n;
    update office.requests set status = 'done', answer = v_ans, updated_at = now() where id = q.id;
    return jsonb_build_object('mode','answer','answer', v_ans);
  end if;
  if q.scope = 'all_active_clients' or (t ~ 'כל הלקוחות' and t ~ '(תוכנית עבודה|גאנט|תוכנית)') then
    for c in select cl.id, cl.name, e.id as eng from office.clients cl join office.engagements e on e.client_id = cl.id and e.status = 'active'
             where cl.org_id = q.org_id and cl.status = 'active' and cl.archived_at is null loop
      v_wf := office.instantiate_workflow(q.org_id, q.id, 'monthly_plan_client', c.id, null,
                jsonb_build_object('month', v_month, 'engagement_id', c.eng, 'instruction', q.text), 'monthly:'||c.eng||':'||v_month, null, null, c.name);
      r := r || jsonb_build_object('client', c.name, 'workflow_run_id', v_wf, 'workflow', 'monthly_plan_client');
    end loop;
    update office.requests set status = case when jsonb_array_length(r) = 0 then 'done' else 'running' end,
      answer = case when jsonb_array_length(r) = 0 then 'אין לקוחות עם התקשרות פעילה — לא נפתחה עבודה.' end,
      plan = coalesce(plan,'{}'::jsonb) || jsonb_build_object('month', v_month, 'opened', r), updated_at = now() where id = q.id;
    return jsonb_build_object('mode','work','opened', r);
  end if;
  if q.client_id is not null and t ~ '(גאנט|תוכנית עבודה|תוכנית תוכן)' then
    select id into v_eng from office.engagements where client_id = q.client_id and status = 'active' order by created_at desc limit 1;
    v_wf := office.instantiate_workflow(q.org_id, q.id, 'monthly_plan_client', q.client_id, q.project_id,
      jsonb_build_object('month', v_month, 'engagement_id', v_eng, 'instruction', q.text), 'monthly:'||coalesce(v_eng::text,'none:'||q.client_id)||':'||v_month);
    r := jsonb_build_array(jsonb_build_object('workflow','monthly_plan_client','workflow_run_id',v_wf));
  elsif q.client_id is not null and t ~ '(סרטון|וידאו|רילס)' then
    v_wf := office.instantiate_workflow(q.org_id, q.id, 'video_production', q.client_id, q.project_id, jsonb_build_object('instruction', q.text), 'req:'||q.id);
    r := jsonb_build_array(jsonb_build_object('workflow','video_production','workflow_run_id',v_wf));
  elsif (q.plan->>'proposal_id') is not null then
    v_wf := office.instantiate_workflow(q.org_id, q.id, 'sales_proposal', q.client_id, null,
      jsonb_build_object('proposal_id', q.plan->>'proposal_id', 'lead_id', q.plan->>'lead_id', 'instruction', q.text), 'proposal:'||(q.plan->>'proposal_id')||':'||q.id);
    r := jsonb_build_array(jsonb_build_object('workflow','sales_proposal','workflow_run_id',v_wf));
  elsif t ~ '(בקומה|כתבה)' then
    v_wf := office.instantiate_workflow(q.org_id, q.id, 'bakoma_article', q.client_id, q.project_id, jsonb_build_object('instruction', q.text), 'req:'||q.id);
    r := jsonb_build_array(jsonb_build_object('workflow','bakoma_article','workflow_run_id',v_wf));
  elsif q.client_id is not null and t ~ '(rtm|טרנד|אקטואלי)' then
    v_wf := office.instantiate_workflow(q.org_id, q.id, 'rtm_scan', q.client_id, q.project_id, jsonb_build_object('instruction', q.text), 'req:'||q.id);
    r := jsonb_build_array(jsonb_build_object('workflow','rtm_scan','workflow_run_id',v_wf));
  elsif q.client_id is not null and t ~ '(קמפיין|ביצועים|roas|עלות לליד)' then
    v_wf := office.instantiate_workflow(q.org_id, q.id, 'campaign_review', q.client_id, q.project_id, jsonb_build_object('instruction', q.text), 'req:'||q.id);
    r := jsonb_build_array(jsonb_build_object('workflow','campaign_review','workflow_run_id',v_wf));
  elsif t ~ '(פולואפ|follow)' then
    v_wf := office.instantiate_workflow(q.org_id, q.id, 'single_agent', q.client_id, q.project_id, jsonb_build_object('instruction', q.text), 'req:'||q.id, null, 'crm_followup');
    r := jsonb_build_array(jsonb_build_object('workflow','single_agent','agent','crm_followup','workflow_run_id',v_wf));
  elsif t ~ '(כיווני קריאייטיב|רעיונות)' then
    v_wf := office.instantiate_workflow(q.org_id, q.id, 'single_agent', q.client_id, q.project_id, jsonb_build_object('instruction', q.text), 'req:'||q.id, null, 'creator');
    r := jsonb_build_array(jsonb_build_object('workflow','single_agent','agent','creator','workflow_run_id',v_wf));
  else
    v_wf := office.instantiate_workflow(q.org_id, q.id, 'free_request', q.client_id, q.project_id, jsonb_build_object('instruction', q.text, 'mode', q.mode), 'req:'||q.id);
    r := jsonb_build_array(jsonb_build_object('workflow','free_request','workflow_run_id',v_wf));
  end if;
  update office.requests set status = 'running', plan = coalesce(plan,'{}'::jsonb) || jsonb_build_object('opened', r), updated_at = now() where id = q.id;
  return jsonb_build_object('mode', q.mode, 'opened', r);
end $$;

create or replace function office.fire_event(p_org uuid, p_event text, p_client uuid, p_ref text, p_text text) returns int
language plpgsql security definer set search_path = office, public as $$
declare a office.automations; v_req uuid; n int := 0;
begin
  for a in select * from office.automations where org_id = p_org and status = 'active' and trigger_type = 'event' and event_key = p_event loop
    if a.client_scope = 'selected' and not (p_client = any(coalesce(a.client_ids,'{}'))) then continue; end if;
    insert into office.automation_fires(automation_id, fire_key) values (a.id, p_event||':'||p_ref) on conflict do nothing;
    if not found then continue; end if;
    insert into office.requests(org_id, source, mode, text, client_id, scope, status, plan, idempotency_key)
    values (p_org, 'event', 'work', coalesce(a.params->>'instruction', p_text), p_client, case when p_client is null then 'pixel' else 'client' end, 'planning',
            a.params, 'auto:'||a.id||':'||p_event||':'||p_ref) returning id into v_req;
    update office.automation_fires set request_id = v_req where automation_id = a.id and fire_key = p_event||':'||p_ref;
    perform office.route_request(v_req);
    update office.automations set last_run_at = now() where id = a.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.office_quota(p_period uuid) returns jsonb
language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships; sp office.service_periods;
begin
  m := office.ctx();
  select * into sp from office.service_periods where id = p_period and org_id = m.org_id;
  if sp.id is null or not office.can_client(m, sp.client_id) then raise exception 'not_found'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('entitlement_id', e.id, 'title', e.title, 'unit', e.unit, 'committed', e.quantity_per_period,
      'allocated', (select count(*) from office.quota_allocations q where q.period_id = sp.id and q.entitlement_id = e.id and q.state = 'allocated'),
      'in_progress', (select count(*) from office.quota_allocations q where q.period_id = sp.id and q.entitlement_id = e.id and q.state = 'in_progress'),
      'delivered', (select count(*) from office.quota_allocations q where q.period_id = sp.id and q.entitlement_id = e.id and q.state = 'delivered'),
      'available', e.quantity_per_period - (select count(*) from office.quota_allocations q where q.period_id = sp.id and q.entitlement_id = e.id and q.state <> 'released'),
      'rule', 'יתרה = התחייבות − פריטים שהוקצו (כל פריט נספר פעם אחת, בלי קשר לסטטוס או לניסיונות חוזרים)')), '[]'::jsonb)
    from office.service_entitlements e where e.engagement_id = sp.engagement_id and e.active);
end $$;
revoke execute on function public.office_quota(uuid) from anon, public;
grant execute on function public.office_quota(uuid) to authenticated;

create or replace function public.office_dashboard() returns jsonb
language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships;
begin
  m := office.ctx();
  return jsonb_build_object(
    'waiting_me', (select count(*) from office.task_runs t where t.org_id = m.org_id and t.status = 'waiting_approval' and office.can_client(m, t.client_id))
                + (select count(*) from office.message_drafts d where d.org_id = m.org_id and d.status in ('pending_approval','needs_review') and m.role in ('owner','admin')),
    'messages_pending', (select count(*) from office.message_drafts d where d.org_id = m.org_id and d.status = 'pending_approval' and m.role in ('owner','admin')),
    'stuck', (select count(*) from office.task_runs t where t.org_id = m.org_id and t.status in ('waiting_connection','waiting_input','waiting_local','failed','uncertain') and office.can_client(m, t.client_id)),
    'running', (select count(*) from office.task_runs t where t.org_id = m.org_id and t.status in ('running','queued','retrying') and office.can_client(m, t.client_id)),
    'due_7d', (select count(*) from office.content_items c where c.org_id = m.org_id and c.due_at between now() and now() + interval '7 days' and c.production_status <> 'approved' and office.can_client(m, c.client_id)),
    'connections_attention', (select count(*) from office.connections c where c.org_id = m.org_id and c.disconnected_at is null and c.status not in ('access_verified','action_tested') and m.role in ('owner','admin')),
    'usage_month_usd', (select coalesce(sum(cost_usd),0) from office.usage_entries u where u.org_id = m.org_id and u.created_at >= date_trunc('month', now()) and m.role in ('owner','admin')),
    'active_clients', (select count(*) from office.clients c where c.org_id = m.org_id and c.status = 'active' and office.can_client(m, c.id)),
    'open_leads', (select count(*) from office.leads l where l.org_id = m.org_id and l.stage not in ('engaged','lost','archived') and m.role in ('owner','admin')),
    'workers', (select coalesce(jsonb_agg(to_jsonb(w)),'[]'::jsonb) from office.worker_heartbeats w where m.role in ('owner','admin')),
    'runners', (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'last_heartbeat_at',r.last_heartbeat_at,'paired',r.token_hash is not null,'revoked',r.revoked_at is not null)),'[]'::jsonb) from office.local_runners r where r.org_id = m.org_id and m.role in ('owner','admin')),
    'last_event_id', (select coalesce(max(id),0) from office.task_events where org_id = m.org_id));
end $$;
revoke execute on function public.office_dashboard() from anon, public;
grant execute on function public.office_dashboard() to authenticated;

create or replace function public.office_agent_board() returns jsonb
language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships;
begin
  m := office.ctx();
  return (select coalesce(jsonb_agg(x order by (x->>'number')::int), '[]'::jsonb) from (
    select jsonb_build_object('id', a.id, 'number', a.number, 'name', a.name, 'role_title', a.role_title, 'department', a.department, 'avatar_key', a.avatar_key,
      'status', a.status, 'version', a.current_version,
      'required_capabilities', (select v.required_capabilities from office.agent_versions v where v.agent_id = a.id and v.version_no = a.current_version),
      'tools', (select v.tools from office.agent_versions v where v.agent_id = a.id and v.version_no = a.current_version),
      'counts', (select jsonb_object_agg(s, n) from (select t.status::text s, count(*) n from office.task_runs t where t.agent_id = a.id and t.org_id = m.org_id and office.can_client(m, t.client_id) group by t.status) z),
      'current', (select jsonb_build_object('task_id', t.id, 'title', t.title, 'status', t.status, 'stage', t.stage, 'last_action', t.last_action,
          'blocker', t.blocker, 'updated_at', t.updated_at, 'client_id', t.client_id, 'client', cl.name, 'project_id', t.project_id, 'cost', t.cost_reported, 'artifacts', t.output_artifact_ids)
        from office.task_runs t left join office.clients cl on cl.id = t.client_id
        where t.agent_id = a.id and t.org_id = m.org_id and office.can_client(m, t.client_id)
          and t.status in ('running','retrying','waiting_approval','waiting_input','waiting_connection','waiting_local','queued','failed','uncertain')
        order by case t.status when 'running' then 0 when 'retrying' then 1 when 'waiting_approval' then 2 when 'waiting_input' then 3 when 'waiting_local' then 4 when 'waiting_connection' then 5 when 'failed' then 6 when 'uncertain' then 7 else 8 end, t.updated_at desc limit 1),
      'last_done', (select jsonb_build_object('title', t.title, 'finished_at', t.finished_at, 'artifacts', t.output_artifact_ids) from office.task_runs t where t.agent_id = a.id and t.org_id = m.org_id and t.status = 'done' and office.can_client(m, t.client_id) order by t.finished_at desc nulls last limit 1)
    ) x from office.agent_definitions a where a.org_id = m.org_id and a.status <> 'archived') s);
end $$;
revoke execute on function public.office_agent_board() from anon, public;
grant execute on function public.office_agent_board() to authenticated;

create or replace function public.office_artifact(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships; a office.artifacts;
begin
  m := office.ctx();
  select * into a from office.artifacts where id = p_id and org_id = m.org_id;
  if a.id is null or not office.can_project(m, a.client_id, a.project_id) then raise exception 'not_found'; end if;
  return to_jsonb(a) || jsonb_build_object('versions', (select coalesce(jsonb_agg(to_jsonb(v) order by v.version_no desc),'[]'::jsonb) from office.artifact_versions v where v.artifact_id = a.id),
    'reviews', (select coalesce(jsonb_agg(to_jsonb(r) order by r.decided_at desc),'[]'::jsonb) from office.reviews r join office.artifact_versions v on v.id = r.artifact_version_id where v.artifact_id = a.id));
end $$;
revoke execute on function public.office_artifact(uuid) from anon, public;
grant execute on function public.office_artifact(uuid) to authenticated;
