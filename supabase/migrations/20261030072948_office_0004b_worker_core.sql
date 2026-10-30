-- applied migration: office_0004b_worker_core (version 20261030072948)
create or replace function office.task_context(t office.task_runs) returns jsonb
language sql stable security definer set search_path = office, public as $$
  select jsonb_build_object(
    'task', to_jsonb(t) - 'lease_token',
    'agent', (select to_jsonb(a) from office.agent_definitions a where a.id = t.agent_id),
    'agent_version', (select to_jsonb(v) from office.agent_versions v where v.agent_id = t.agent_id and v.version_no = coalesce(t.agent_version, (select current_version from office.agent_definitions where id = t.agent_id))),
    'client', (select jsonb_build_object('id', c.id, 'name', c.name, 'industry', c.industry, 'department', c.department, 'profile', c.profile, 'is_test', c.is_test) from office.clients c where c.id = t.client_id),
    'project', (select jsonb_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'site_url', p.site_url, 'details', p.details) from office.projects p where p.id = t.project_id),
    'content_item', (select to_jsonb(ci) from office.content_items ci where ci.id = t.content_item_id),
    'request', (select jsonb_build_object('text', r.text, 'mode', r.mode, 'scope', r.scope) from office.requests r where r.id = t.request_id),
    'knowledge', (select coalesce(jsonb_agg(jsonb_build_object('title', k.title, 'body', left(k.body, 1500), 'kind', k.kind, 'source', k.source_url)), '[]'::jsonb) from (
        select * from office.knowledge_items k where k.org_id = t.org_id and k.archived_at is null and k.approval_status = 'approved'
          and (k.scope = 'pixel' or (k.scope = 'client' and k.client_id = t.client_id) or (k.scope = 'project' and k.project_id = t.project_id)
               or (k.scope = 'department' and k.department = (select department from office.clients where id = t.client_id)))
          and (k.valid_until is null or k.valid_until >= current_date)
        order by k.updated_at desc limit 25) k),
    'dependencies', (select coalesce(jsonb_agg(jsonb_build_object('step', d.step_key, 'title', d.title, 'outputs', d.outputs,
        'artifacts', (select coalesce(jsonb_agg(jsonb_build_object('artifact_id', ar.id, 'kind', ar.kind, 'title', ar.title, 'version_id', av.id, 'version_no', av.version_no, 'body', left(av.body, 12000), 'data', av.data, 'storage_path', av.storage_path, 'mime', av.mime)), '[]'::jsonb)
           from office.artifacts ar join office.artifact_versions av on av.artifact_id = ar.id and av.version_no = ar.current_version where ar.id = any(d.output_artifact_ids)))), '[]'::jsonb)
       from office.task_runs d where d.id = any(t.depends_on)),
    'proposal', (select jsonb_build_object('id', p.id, 'title', p.title, 'status', p.status, 'currency', p.currency,
        'locked_price', jsonb_build_object('setup', p.locked_setup, 'monthly', p.locked_monthly, 'media_budget', p.locked_media_budget, 'note', p.locked_total_note, 'locked', p.price_locked_at is not null),
        'totals', office.proposal_totals(p.locked_setup, p.locked_monthly, p.locked_media_budget, p.terms_template_id),
        'terms', (select to_jsonb(tt) from office.terms_templates tt where tt.id = p.terms_template_id),
        'lead', (select to_jsonb(l) - 'client_budget' - 'client_budget_note' - 'contact_phone_e164' - 'contact_email' from office.leads l where l.id = p.lead_id),
        'brief', (select b.content from office.briefs b where b.lead_id = p.lead_id order by b.version_no desc limit 1))
       from office.proposals p where p.id = nullif(t.inputs->'params'->>'proposal_id','')::uuid),
    'contacts', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'role', c.role_title, 'has_verified_phone', c.phone_verified and c.phone_e164 is not null)), '[]'::jsonb)
       from office.contacts c where c.client_id = t.client_id and c.archived_at is null),
    'quota', (select coalesce(jsonb_agg(jsonb_build_object('service', e.title, 'unit', e.unit, 'quantity', e.quantity_per_period)), '[]'::jsonb)
       from office.service_entitlements e join office.engagements en on en.id = e.engagement_id where en.client_id = t.client_id and en.status = 'active' and e.active)
  ) $$;

create or replace function office.local_runner_online(p_org uuid, p_cap text) returns boolean language sql stable security definer set search_path = office, public as $$
  select exists(select 1 from office.local_runners r where r.org_id = p_org and r.revoked_at is null and r.token_hash is not null
    and r.last_heartbeat_at > now() - interval '2 minutes' and p_cap = any(r.capabilities)) $$;

create or replace function office.killed(t office.task_runs) returns boolean language sql stable security definer set search_path = office, public as $$
  select exists(select 1 from office.kill_switches k where k.org_id = t.org_id and k.active and (
    k.scope_type = 'system' or (k.scope_type = 'client' and k.scope_ref = t.client_id::text) or (k.scope_type = 'agent' and k.scope_ref = t.agent_id))) $$;

create or replace function office.month_spend(p_org uuid) returns numeric language sql stable security definer set search_path = office, public as $$
  select coalesce((select sum(cost_usd) from office.usage_entries where org_id = p_org and created_at >= date_trunc('month', now())),0)
       + coalesce((select sum(amount_usd) from office.budget_reservations where org_id = p_org and status = 'reserved'),0) $$;

create or replace function office.finish_check(p_wf uuid) returns void language plpgsql security definer set search_path = office, public as $$
declare w office.workflow_runs;
begin
  select * into w from office.workflow_runs where id = p_wf;
  if w.id is null then return; end if;
  if not exists(select 1 from office.task_runs where workflow_run_id = p_wf and status not in ('done','cancelled')) then
    update office.workflow_runs set status = case when w.status = 'cancelled' then 'cancelled' else 'done' end, updated_at = now() where id = p_wf;
    if w.request_id is not null and not exists(select 1 from office.workflow_runs where request_id = w.request_id and status in ('running','paused','blocked')) then
      update office.requests set status = case when status = 'cancelled' then 'cancelled' else 'done' end, updated_at = now() where id = w.request_id;
    end if;
    perform office.emit(w.org_id, 'workflow.done', 'תהליך הושלם', null, p_wf, w.request_id, null, w.client_id);
  end if;
end $$;

create or replace function office.lease_ok(p_task uuid, p_lease uuid) returns office.task_runs
language plpgsql security definer set search_path = office, public as $$
declare t office.task_runs;
begin
  select * into t from office.task_runs where id = p_task for update;
  if t.id is null then raise exception 'task_not_found'; end if;
  if t.lease_token is distinct from p_lease then raise exception 'stale_lease'; end if;
  return t;
end $$;

create or replace function public.office_worker_claim(p_secret text, p_worker text, p_max int default 4) returns jsonb
language plpgsql security definer set search_path = office, public, extensions as $$
declare v_org uuid; t office.task_runs; out jsonb := '[]'::jsonb; cap text; v_block text; v_cnt int := 0; v_budget numeric; d office.message_drafts; v_aw jsonb;
begin
  v_org := office.worker_org(p_secret);
  insert into office.worker_heartbeats(worker_id, kind, last_seen, info) values (p_worker, 'cloud', now(), jsonb_build_object('max', p_max))
  on conflict (worker_id) do update set last_seen = now();
  update office.task_runs set status = case when attempts >= max_attempts then 'failed'::office.task_status else 'retrying'::office.task_status end,
    blocker = case when attempts >= max_attempts then 'חרג ממספר הניסיונות לאחר timeout' else 'הריצה הקודמת לא דיווחה (timeout) — ניסיון מבוקר' end,
    lease_token = null, next_attempt_at = now() + (interval '30 seconds' * power(2, least(attempts,6))), updated_at = now()
  where org_id = v_org and status = 'running' and lease_until < now() and inputs->>'kind' not like 'local:%';
  update office.budget_reservations b set status = 'released' from office.task_runs t2
    where b.task_run_id = t2.id and b.status = 'reserved' and t2.status in ('retrying','failed','cancelled');
  for d in select * from office.message_drafts where org_id = v_org and status = 'draft' and scheduled_for <= now() for update skip locked loop
    update office.message_drafts set status = 'pending_approval' where id = d.id;
    insert into office.notifications(org_id, kind, title, link) values (v_org, 'approval', 'תזכורת מוכנה לאישורך', '/approvals?draft='||d.id);
  end loop;
  update office.task_runs t3 set status = 'queued', blocker = null, updated_at = now()
   where t3.org_id = v_org and t3.status = 'waiting_connection'
     and not exists(select 1 from unnest(t3.required_capabilities) c where c <> 'render_video' and office.capability_conn(t3.org_id, t3.client_id, c) is null)
     and (not ('render_video' = any(t3.required_capabilities)) or office.local_runner_online(t3.org_id, 'ffmpeg'));
  for t in select g.* from office.task_runs g where g.org_id = v_org and g.status = 'queued' and g.inputs->>'kind' like 'gate:%'
           and not exists(select 1 from office.task_runs d2 where d2.id = any(g.depends_on) and d2.status <> 'done') for update of g skip locked loop
    select coalesce(jsonb_agg(av.id), '[]'::jsonb) into v_aw from office.artifacts ar
      join office.artifact_versions av on av.artifact_id = ar.id and av.version_no = ar.current_version
      join office.task_runs src on ar.id = any(src.output_artifact_ids)
      where src.workflow_run_id = t.workflow_run_id and ar.kind not in ('report','research','plan','brief');
    update office.task_runs set status = 'waiting_approval', stage = 'ממתין לאישור שלך', inputs = inputs || jsonb_build_object('awaiting_versions', v_aw), updated_at = now() where id = t.id;
    if t.inputs->>'kind' = 'gate:proposal' then
      update office.proposals set status = 'pending_owner', updated_at = now() where id = nullif(t.inputs->'params'->>'proposal_id','')::uuid and status in ('drafting','in_review');
      update office.leads set stage = 'pending_approval', updated_at = now() where id = (select lead_id from office.proposals where id = nullif(t.inputs->'params'->>'proposal_id','')::uuid);
    end if;
    if t.content_item_id is not null then update office.content_items set production_status = 'in_review', updated_at = now() where id = t.content_item_id; end if;
    insert into office.notifications(org_id, kind, title, link) values (v_org, 'approval', t.title, '/tasks/'||t.id);
    perform office.emit(v_org, 'task.waiting_approval', t.title, t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
  end loop;
  select monthly_limit_usd into v_budget from office.budgets where org_id = v_org and scope_type = 'org' and scope_ref = 'org';
  for t in select tr.* from office.task_runs tr
           join office.workflow_runs w on w.id = tr.workflow_run_id and w.status = 'running'
           left join office.requests rq on rq.id = tr.request_id
           left join office.agent_definitions ag on ag.id = tr.agent_id
           where tr.org_id = v_org and tr.status in ('queued','retrying') and tr.next_attempt_at <= now()
             and tr.inputs->>'kind' not like 'gate:%' and tr.inputs->>'kind' not like 'local:%'
             and coalesce(rq.status,'running') not in ('paused','cancelled')
             and (ag.id is null or ag.status = 'active' or (ag.status = 'testing' and w.workflow_key = 'agent_trial'))
             and not exists(select 1 from office.task_runs d2 where d2.id = any(tr.depends_on) and d2.status <> 'done')
           order by tr.created_at limit 50 for update of tr skip locked loop
    exit when v_cnt >= p_max;
    if office.killed(t) then continue; end if;
    v_block := null;
    foreach cap in array t.required_capabilities loop
      if office.capability_conn(t.org_id, t.client_id, cap) is null then v_block := office.capability_blocker(cap); exit; end if;
    end loop;
    if v_block is not null then
      update office.task_runs set status = 'waiting_connection', blocker = v_block, stage = 'ממתין לחיבור', updated_at = now() where id = t.id;
      perform office.emit(t.org_id, 'task.blocked', v_block, t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
      continue;
    end if;
    if v_budget is not null and office.month_spend(t.org_id) + 0.5 > v_budget then
      update office.task_runs set status = 'waiting_input', blocker = 'תקרת העלות החודשית הושגה — נדרשת החלטתך להגדלה', updated_at = now() where id = t.id;
      continue;
    end if;
    update office.task_runs set status = 'running', lease_token = gen_random_uuid(), lease_until = now() + make_interval(secs => timeout_seconds),
      heartbeat_at = now(), attempts = attempts + 1, started_at = coalesce(started_at, now()), stage = 'בעבודה', updated_at = now()
      where id = t.id returning * into t;
    insert into office.budget_reservations(org_id, task_run_id, attempt, amount_usd) values (t.org_id, t.id, t.attempts, 0.5) on conflict do nothing;
    if t.content_item_id is not null then
      update office.quota_allocations set state = 'in_progress', updated_at = now() where content_item_id = t.content_item_id and state = 'allocated';
      update office.content_items set production_status = 'in_production', updated_at = now() where id = t.content_item_id and production_status = 'planned';
    end if;
    perform office.emit(t.org_id, 'task.started', t.title, t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
    out := out || jsonb_build_array(office.task_context(t) || jsonb_build_object('lease_token', t.lease_token));
    v_cnt := v_cnt + 1;
  end loop;
  return out;
end $$;

create or replace function public.office_worker_heartbeat(p_secret text, p_task uuid, p_lease uuid, p_stage text, p_action text default null) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs;
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  update office.task_runs set heartbeat_at = now(), lease_until = now() + make_interval(secs => timeout_seconds), stage = coalesce(p_stage, stage),
    last_action = coalesce(p_action, last_action), updated_at = now() where id = t.id;
  perform office.emit(t.org_id, 'task.progress', coalesce(p_action, p_stage), t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
  return jsonb_build_object('cancelled', t.status = 'cancelled');
end $$;
