-- 0051 autopilot: research for new clients, monthly content gantts, daily RTM — each behind an owner switch.
-- Also: scheduled automations over all clients now honour their workflow_key (previously always opened monthly plans).

-- 1) tick_automations passes the automation's workflow_key into the request plan
do $$ declare d text; begin
  select pg_get_functiondef('public.office_worker_tick_automations'::regproc) into d;
  if position('''automation_id'', a.id)' in d) = 0 then raise exception 'tick_automations pattern not found'; end if;
  d := replace(d, '''automation_id'', a.id)', '''automation_id'', a.id, ''workflow_key'', a.workflow_key)');
  execute d;
end $$;

-- 2) route_request: all-clients fan-out runs the requested workflow (optionally only for clients with a given service)
do $$ declare d text; anchor text := '  if q.scope = ''all_active_clients'' or (t ~ ''כל הלקוחות'''; begin
  select pg_get_functiondef('office.route_request'::regproc) into d;
  if position(anchor in d) = 0 then raise exception 'route_request pattern not found'; end if;
  d := replace(d, anchor, $x$  if q.scope = 'all_active_clients' and coalesce(q.plan->>'workflow_key', 'monthly_plan_client') <> 'monthly_plan_client' then
    for c in select cl.id, cl.name from office.clients cl
             where cl.org_id = q.org_id and cl.status = 'active' and cl.archived_at is null and not cl.is_test
               and (nullif(q.plan->>'only_service', '') is null or cl.profile->'services' ? (q.plan->>'only_service')) loop
      v_wf := office.instantiate_workflow(q.org_id, q.id, q.plan->>'workflow_key', c.id, null,
                jsonb_build_object('instruction', q.text, 'month', v_month), (q.plan->>'workflow_key') || ':' || c.id || ':' || q.id, null, null, c.name);
      r := r || jsonb_build_object('client', c.name, 'workflow_run_id', v_wf, 'workflow', q.plan->>'workflow_key');
    end loop;
    update office.requests set status = case when jsonb_array_length(r) = 0 then 'done' else 'running' end,
      answer = case when jsonb_array_length(r) = 0 then 'אין לקוחות מתאימים — לא נפתחה עבודה.' end,
      plan = coalesce(plan, '{}'::jsonb) || jsonb_build_object('opened', r), updated_at = now() where id = q.id;
    return jsonb_build_object('mode', 'work', 'opened', r);
  end if;
$x$ || anchor);
  execute d;
end $$;

-- 3) owner switches
do $$ declare d text; begin
  select pg_get_functiondef('office.act_care'::regproc) into d;
  if position('(''google_review_url'',''public_url'')' in d) = 0 then raise exception 'act_care pattern not found'; end if;
  d := replace(d, '(''google_review_url'',''public_url'')', '(''google_review_url'',''public_url'',''autopilot_research'',''autopilot_gantt'',''autopilot_gantt_day'',''autopilot_rtm'',''autopilot_rtm_days'')');
  execute d;
end $$;

-- 4) the autopilot worker (called hourly by the tick)
create or replace function public.office_worker_autopilot(p_secret text) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; m office.memberships; c record; lnow timestamp; v_next date; v_day int; out jsonb := '{}'::jsonb;
  n_r int := 0; n_g int := 0; n_t int := 0; v_req uuid; v_today text; v_dows text;
begin
  v_org := office.worker_org(p_secret);
  select * into m from office.memberships where org_id = v_org and role = 'owner' order by created_at limit 1;
  if m.user_id is null then return jsonb_build_object('skipped', 'no_owner'); end if;
  lnow := now() at time zone 'Asia/Jerusalem'; v_today := to_char(lnow, 'YYYY-MM-DD');

  -- research: every active client that has a website and was never researched (max 3 per hour)
  if coalesce(office.setting(v_org, 'autopilot_research'), 'off') = 'on' then
    for c in select cl.id from office.clients cl
             where cl.org_id = v_org and cl.status = 'active' and cl.archived_at is null and not cl.is_test
               and coalesce(cl.profile->>'website', '') <> ''
               and not exists (select 1 from office.requests r where r.client_id = cl.id and r.idempotency_key like 'research:' || cl.id || '%')
             order by cl.created_at limit 3 loop
      begin perform office.act_research(m, 'start_client_research', jsonb_build_object('client_id', c.id, 'run', 'auto')); n_r := n_r + 1;
      exception when others then out := out || jsonb_build_object('research_error', sqlerrm); end;
    end loop;
  end if;

  -- monthly gantt: from day N of the month, next month's gantt for social clients that have an approved brand dossier (max 3 per hour)
  v_day := coalesce(nullif(office.setting(v_org, 'autopilot_gantt_day'), '')::int, 20);
  if coalesce(office.setting(v_org, 'autopilot_gantt'), 'off') = 'on' and extract(day from lnow) >= v_day then
    v_next := (date_trunc('month', lnow) + interval '1 month')::date;
    for c in select cl.id, cl.profile from office.clients cl
             where cl.org_id = v_org and cl.status = 'active' and cl.archived_at is null and not cl.is_test
               and cl.profile->'services' ? 'social'
               and exists (select 1 from office.knowledge_items k where k.client_id = cl.id and k.approval_status = 'approved')
               and not exists (select 1 from office.requests r where r.client_id = cl.id and r.idempotency_key like 'content:' || cl.id || ':' || to_char(v_next, 'YYYY-MM') || '%')
               and not exists (select 1 from office.content_items ci where ci.client_id = cl.id and ci.archived_at is null and ci.due_at >= v_next and ci.due_at < v_next + interval '1 month')
             order by cl.created_at limit 3 loop
      begin perform office.act_content(m, 'start_content_month', jsonb_build_object('client_id', c.id, 'month', to_char(v_next, 'YYYY-MM'),
          'posts_per_week', coalesce(nullif(c.profile->>'posts_per_week', '')::int, 3))); n_g := n_g + 1;
      exception when others then out := out || jsonb_build_object('gantt_error', sqlerrm); end;
    end loop;
  end if;

  -- RTM: once per selected weekday (default Sun–Thu) from 08:00, per social client with an approved dossier (max 6 per hour)
  v_dows := coalesce(nullif(office.setting(v_org, 'autopilot_rtm_days'), ''), '0,1,2,3,4');
  if coalesce(office.setting(v_org, 'autopilot_rtm'), 'off') = 'on' and extract(hour from lnow) >= 8
     and (extract(dow from lnow))::int::text = any(string_to_array(v_dows, ',')) then
    for c in select cl.id, cl.name from office.clients cl
             where cl.org_id = v_org and cl.status = 'active' and cl.archived_at is null and not cl.is_test
               and cl.profile->'services' ? 'social'
               and exists (select 1 from office.knowledge_items k where k.client_id = cl.id and k.approval_status = 'approved')
               and not exists (select 1 from office.requests r where r.org_id = v_org and r.idempotency_key = 'rtm:' || cl.id || ':' || v_today)
             order by cl.created_at limit 6 loop
      v_req := null;
      insert into office.requests(org_id, source, mode, text, client_id, scope, status, idempotency_key)
      values (v_org, 'schedule', 'work', 'סריקת RTM יומית: ' || c.name, c.id, 'client', 'running', 'rtm:' || c.id || ':' || v_today)
      on conflict do nothing returning id into v_req;
      if v_req is not null then
        perform office.instantiate_workflow(v_org, v_req, 'rtm_scan', c.id, null,
          jsonb_build_object('instruction', 'מצא אירוע/טרנד/מועד אקטואלי מהיום-מחר שרלוונטי ללקוח והצע תגובת תוכן אחת. אם אין משהו באמת רלוונטי — כתוב "אין היום" ואל תמציא. דלג על נושאים רגישים.'),
          'rtm:' || c.id || ':' || v_today, null, null, c.name);
        n_t := n_t + 1;
      end if;
    end loop;
  end if;
  return out || jsonb_build_object('research', n_r, 'gantt', n_g, 'rtm', n_t);
end $$;
grant execute on function public.office_worker_autopilot(text) to anon;

-- 5) status for the settings card
create or replace function public.office_autopilot() returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare m office.memberships; begin
  m := office.ctx(); if m.id is null then raise exception 'not_authenticated'; end if;
  return jsonb_build_object(
    'research', coalesce(office.setting(m.org_id, 'autopilot_research'), 'off'),
    'gantt', coalesce(office.setting(m.org_id, 'autopilot_gantt'), 'off'),
    'gantt_day', coalesce(nullif(office.setting(m.org_id, 'autopilot_gantt_day'), ''), '20'),
    'rtm', coalesce(office.setting(m.org_id, 'autopilot_rtm'), 'off'),
    'rtm_days', coalesce(nullif(office.setting(m.org_id, 'autopilot_rtm_days'), ''), '0,1,2,3,4'),
    'clients', (select count(*) from office.clients where org_id = m.org_id and status = 'active' and archived_at is null and not is_test),
    'with_site', (select count(*) from office.clients where org_id = m.org_id and status = 'active' and archived_at is null and not is_test and coalesce(profile->>'website','') <> ''),
    'researched', (select count(distinct cl.id) from office.clients cl join office.requests r on r.client_id = cl.id and r.idempotency_key like 'research:' || cl.id || '%' where cl.org_id = m.org_id and cl.status = 'active' and not cl.is_test),
    'with_dossier', (select count(distinct k.client_id) from office.knowledge_items k join office.clients cl on cl.id = k.client_id where cl.org_id = m.org_id and cl.status = 'active' and not cl.is_test and k.approval_status = 'approved'),
    'social', (select count(*) from office.clients where org_id = m.org_id and status = 'active' and archived_at is null and not is_test and profile->'services' ? 'social'),
    'missing_site', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]') from office.clients where org_id = m.org_id and status = 'active' and archived_at is null and not is_test and coalesce(profile->>'website','') = ''));
end $$;
grant execute on function public.office_autopilot() to authenticated;
