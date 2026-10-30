-- applied migration: office_0004c_worker_complete (version 20261030073021)
create or replace function public.office_worker_complete(p_secret text, p_task uuid, p_lease uuid, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs; a jsonb; av office.artifact_versions; ids uuid[] := '{}'; u jsonb; v_cost numeric := 0; dep_versions uuid[];
  st jsonb; i int := 0; v_wf uuid; v_cancelled boolean; v_existing uuid;
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  v_cancelled := t.status = 'cancelled';
  select coalesce(array_agg(av2.id), '{}') into dep_versions from office.task_runs d
    join office.artifacts ar on ar.id = any(d.output_artifact_ids) join office.artifact_versions av2 on av2.artifact_id = ar.id and av2.version_no = ar.current_version
    where d.id = any(t.depends_on);
  for a in select * from jsonb_array_elements(coalesce(p_result->'artifacts','[]'::jsonb)) loop
    v_existing := coalesce(nullif(a->>'artifact_id','')::uuid, (select ar.id from office.artifacts ar where ar.id = any(t.output_artifact_ids) and ar.kind = a->>'kind' limit 1));
    av := office.add_artifact_version(t.org_id, t.client_id, t.project_id, t.content_item_id, v_existing,
      a->>'kind', a->>'title', a->>'body', a->'data', t.agent_id, t.id, p_result->>'model', null, dep_versions,
      coalesce(a->>'diff_summary', case when t.inputs ? 'revision' then 'תיקון לפי משוב: '||coalesce(t.inputs->'revision'->>'comment','') end),
      coalesce(a->>'mime','text/markdown'), a->>'storage_path', coalesce(a->'meta','{}'::jsonb));
    ids := ids || av.artifact_id;
  end loop;
  for u in select * from jsonb_array_elements(coalesce(p_result->'usage','[]'::jsonb)) loop
    insert into office.usage_entries(org_id, client_id, project_id, agent_id, task_run_id, provider, model, cost_kind, input_units, output_units, cost_usd, note)
    values (t.org_id, t.client_id, t.project_id, t.agent_id, t.id, u->>'provider', u->>'model', coalesce(u->>'cost_kind','computed'),
      (u->>'input_units')::numeric, (u->>'output_units')::numeric, (u->>'cost_usd')::numeric, u->>'note');
    v_cost := v_cost + coalesce((u->>'cost_usd')::numeric, 0);
  end loop;
  update office.budget_reservations set status = 'settled', settled_usd = v_cost where task_run_id = t.id and attempt = t.attempts;
  update office.task_runs set status = case when v_cancelled then 'cancelled'::office.task_status else 'done'::office.task_status end,
    outputs = p_result->'outputs', output_artifact_ids = (select array(select distinct x from unnest(output_artifact_ids || ids) x)),
    lease_token = null, finished_at = now(), stage = coalesce(p_result->>'stage','הושלם'), last_action = coalesce(p_result->>'summary', last_action),
    model = coalesce(p_result->>'model', model), cost_reported = cost_reported + v_cost, blocker = null, updated_at = now(), inputs = inputs - 'revision'
  where id = t.id;
  if t.inputs->>'kind' = 'ai_plan' and not v_cancelled then
    for st in select * from jsonb_array_elements(coalesce(p_result->'plan'->'tasks','[]'::jsonb)) loop
      i := i + 1; exit when i > 8;
      if not exists(select 1 from office.agent_definitions where id = st->>'agent_id' and status = 'active') then continue; end if;
      v_wf := office.instantiate_workflow(t.org_id, t.request_id, 'single_agent', t.client_id, t.project_id,
        jsonb_build_object('instruction', st->>'instruction', 'from_plan', t.id), 'plan:'||t.id||':'||i, null, st->>'agent_id', st->>'title');
    end loop;
  end if;
  if p_result ? 'answer' and t.request_id is not null then update office.requests set answer = p_result->>'answer', updated_at = now() where id = t.request_id; end if;
  if (t.inputs->'params') ? 'rewrite_draft_id' and not v_cancelled and (p_result->'outputs'->>'message_body') is not null then
    update office.message_drafts set body = p_result->'outputs'->>'message_body', status = 'pending_approval', review_reason = 'נוסח מחדש לבקשתך', prepared_by_agent = t.agent_id
      where id = (t.inputs->'params'->>'rewrite_draft_id')::uuid and status = 'needs_review';
  end if;
  perform office.emit(t.org_id, 'task.done', t.title, t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id, jsonb_build_object('artifacts', ids));
  perform office.finish_check(t.workflow_run_id);
  return jsonb_build_object('ok', true, 'artifact_ids', ids, 'cancelled', v_cancelled);
end $$;

create or replace function public.office_worker_block(p_secret text, p_task uuid, p_lease uuid, p_status text, p_blocker text, p_checkpoint jsonb default null) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs;
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  if p_status not in ('waiting_input','waiting_connection','waiting_local','uncertain') then raise exception 'bad_block_status'; end if;
  update office.task_runs set status = p_status::office.task_status, blocker = p_blocker, checkpoint = coalesce(p_checkpoint, checkpoint), lease_token = null,
    stage = case p_status when 'waiting_input' then 'ממתין לחומר' when 'waiting_connection' then 'ממתין לחיבור' when 'waiting_local' then 'ממתין למחשב המקומי' else 'מצב לא ודאי' end,
    updated_at = now() where id = t.id;
  update office.budget_reservations set status = 'released' where task_run_id = t.id and attempt = t.attempts and status = 'reserved';
  perform office.emit(t.org_id, 'task.blocked', p_blocker, t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
  return jsonb_build_object('ok', true, 'blocked', p_status);
end $$;

create or replace function public.office_worker_fail(p_secret text, p_task uuid, p_lease uuid, p_error text, p_retryable boolean, p_usage jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs; u jsonb;
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  for u in select * from jsonb_array_elements(coalesce(p_usage,'[]'::jsonb)) loop
    insert into office.usage_entries(org_id, client_id, project_id, agent_id, task_run_id, provider, model, cost_kind, input_units, output_units, cost_usd, note)
    values (t.org_id, t.client_id, t.project_id, t.agent_id, t.id, u->>'provider', u->>'model', coalesce(u->>'cost_kind','computed'), (u->>'input_units')::numeric, (u->>'output_units')::numeric, (u->>'cost_usd')::numeric, 'failed attempt');
  end loop;
  update office.task_runs set
    status = case when p_retryable and attempts < max_attempts then 'retrying'::office.task_status else 'failed'::office.task_status end,
    next_attempt_at = now() + (interval '30 seconds' * power(2, least(attempts, 6))),
    blocker = left(p_error, 500), lease_token = null, stage = case when p_retryable and attempts < max_attempts then 'מנסה שוב' else 'נכשל' end, updated_at = now()
  where id = t.id;
  update office.budget_reservations set status = 'released' where task_run_id = t.id and attempt = t.attempts and status = 'reserved';
  perform office.emit(t.org_id, 'task.failed', left(p_error, 300), t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
  return jsonb_build_object('ok', true);
end $$;
