-- applied migration: office_0004f_runner_grants (version 20261030073448)
create or replace function public.office_runner_pair(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = office, public, extensions as $$
declare r office.local_runners; v_tok text;
begin
  select * into r from office.local_runners where pairing_code_hash = encode(extensions.digest(upper(coalesce(p_code,'')),'sha256'),'hex') and pairing_expires_at > now() and revoked_at is null for update;
  if r.id is null then raise exception 'bad_or_expired_pairing_code'; end if;
  v_tok := encode(extensions.gen_random_bytes(32), 'hex');
  update office.local_runners set token_hash = encode(extensions.digest(v_tok,'sha256'),'hex'), pairing_code_hash = null, paired_at = now(), last_heartbeat_at = now(),
    name = coalesce(nullif(p_name,''), name) where id = r.id;
  perform office.audit(r.org_id, 'system', r.id::text, 'runner_paired', 'local_runner', r.id::text, null, null);
  return jsonb_build_object('runner_id', r.id, 'token', v_tok);
end $$;

create or replace function office.runner_auth(p_token text) returns office.local_runners
language plpgsql security definer set search_path = office, public, extensions as $$
declare r office.local_runners;
begin
  select * into r from office.local_runners where token_hash = encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') and revoked_at is null;
  if r.id is null then raise exception 'runner_not_paired_or_revoked'; end if;
  update office.local_runners set last_heartbeat_at = now() where id = r.id;
  return r;
end $$;

create or replace function public.office_runner_claim(p_token text) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare r office.local_runners; t office.task_runs;
begin
  r := office.runner_auth(p_token);
  delete from office.runner_locks where runner_id = r.id and lease_until < now();
  update office.task_runs set status = 'waiting_local', lease_token = null, blocker = 'המחשב המקומי לא דיווח — ממתין לחידוש', updated_at = now()
    where org_id = r.org_id and status = 'running' and inputs->>'kind' like 'local:%' and lease_until < now();
  select tr.* into t from office.task_runs tr join office.workflow_runs w on w.id = tr.workflow_run_id and w.status = 'running'
    where tr.org_id = r.org_id and tr.status in ('queued','retrying','waiting_local','waiting_connection') and tr.inputs->>'kind' like 'local:%'
      and not exists(select 1 from office.task_runs d where d.id = any(tr.depends_on) and d.status <> 'done') and not office.killed(tr)
    order by tr.created_at limit 1 for update of tr skip locked;
  if t.id is null then return 'null'::jsonb; end if;
  insert into office.runner_locks(runner_id, resource, task_run_id, lease_until) values (r.id, 'ffmpeg', t.id, now() + interval '30 minutes') on conflict (runner_id, resource) do nothing;
  if not found then return 'null'::jsonb; end if;
  update office.task_runs set status = 'running', lease_token = gen_random_uuid(), lease_until = now() + interval '30 minutes', attempts = attempts + 1,
    heartbeat_at = now(), stage = 'רינדור במחשב המקומי', started_at = coalesce(started_at, now()), blocker = null, updated_at = now() where id = t.id returning * into t;
  perform office.emit(t.org_id, 'task.started', t.title, t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
  return office.task_context(t) || jsonb_build_object('lease_token', t.lease_token);
end $$;

create or replace function office.runner_transition(t office.task_runs, p_kind text, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare a jsonb; av office.artifact_versions; ids uuid[] := '{}';
begin
  if p_kind = 'complete' then
    for a in select * from jsonb_array_elements(coalesce(p_result->'artifacts','[]'::jsonb)) loop
      av := office.add_artifact_version(t.org_id, t.client_id, t.project_id, t.content_item_id, null, a->>'kind', a->>'title', a->>'body', a->'data', t.agent_id, t.id,
        'ffmpeg', null, null, a->>'diff_summary', coalesce(a->>'mime','video/mp4'), a->>'storage_path', coalesce(a->'meta','{}'::jsonb));
      ids := ids || av.artifact_id;
    end loop;
    update office.task_runs set status = 'done', outputs = p_result->'outputs', output_artifact_ids = output_artifact_ids || ids, lease_token = null, finished_at = now(), stage = 'הושלם', updated_at = now() where id = t.id;
    perform office.emit(t.org_id, 'task.done', t.title, t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
    perform office.finish_check(t.workflow_run_id);
  elsif p_kind = 'block' then
    update office.task_runs set status = 'waiting_input', blocker = p_result->>'blocker', lease_token = null, updated_at = now() where id = t.id;
  else
    update office.task_runs set status = case when t.attempts < t.max_attempts then 'retrying'::office.task_status else 'failed'::office.task_status end,
      blocker = left(p_result->>'error', 500), lease_token = null, next_attempt_at = now() + interval '2 minutes', updated_at = now() where id = t.id;
    perform office.emit(t.org_id, 'task.failed', left(p_result->>'error',300), t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
  end if;
  return jsonb_build_object('ok', true, 'artifact_ids', ids);
end $$;

create or replace function public.office_runner_report(p_token text, p_task uuid, p_lease uuid, p_kind text, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare r office.local_runners; t office.task_runs;
begin
  r := office.runner_auth(p_token);
  t := office.lease_ok(p_task, p_lease);
  if t.org_id <> r.org_id or t.inputs->>'kind' not like 'local:%' then raise exception 'forbidden'; end if;
  if p_kind = 'heartbeat' then
    update office.task_runs set heartbeat_at = now(), lease_until = now() + interval '30 minutes', stage = coalesce(p_result->>'stage', stage), updated_at = now() where id = t.id;
    update office.runner_locks set lease_until = now() + interval '30 minutes' where runner_id = r.id and task_run_id = t.id;
    return jsonb_build_object('cancelled', t.status = 'cancelled');
  end if;
  delete from office.runner_locks where runner_id = r.id and task_run_id = t.id;
  return office.runner_transition(t, p_kind, p_result);
end $$;

create or replace function public.office_worker_storage_path(p_secret text, p_task uuid, p_lease uuid, p_ext text) returns text
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs;
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  return coalesce(t.client_id::text,'pixel')||'/'||t.id||'/'||t.attempts||'-'||substr(md5(random()::text),1,6)||'.'||regexp_replace(lower(p_ext),'[^a-z0-9]','','g');
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'office_worker_claim(text,text,int)','office_worker_heartbeat(text,uuid,uuid,text,text)','office_worker_complete(text,uuid,uuid,jsonb)',
    'office_worker_block(text,uuid,uuid,text,text,jsonb)','office_worker_fail(text,uuid,uuid,text,boolean,jsonb)','office_worker_system_step(text,uuid,uuid,jsonb)',
    'office_worker_prepare_message(text,uuid,uuid,jsonb)','office_worker_outbox_claim(text,int)','office_worker_outbox_result(text,uuid,text,text,text)',
    'office_worker_connection_report(text,text,text,text,jsonb)','office_provider_event(text,text,text,jsonb)','office_worker_provider_job(text,uuid,uuid,text,jsonb)',
    'office_worker_tick_automations(text)','office_runner_pair(text,text)','office_runner_claim(text)','office_runner_report(text,uuid,uuid,text,jsonb)',
    'office_worker_storage_path(text,uuid,uuid,text)'] loop
    execute format('revoke execute on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
