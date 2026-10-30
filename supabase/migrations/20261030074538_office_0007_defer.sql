-- applied migration: office_0007_defer (version 20261030074538)
create or replace function public.office_worker_defer(p_secret text, p_task uuid, p_lease uuid, p_seconds int, p_stage text, p_checkpoint jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs;
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  -- long provider work (e.g. Kling render): not a failure, the attempt is not consumed
  update office.task_runs set status = case when status = 'cancelled' then status else 'queued'::office.task_status end, lease_token = null,
    attempts = greatest(attempts - 1, 0), next_attempt_at = now() + make_interval(secs => greatest(p_seconds, 15)),
    stage = coalesce(p_stage, stage), checkpoint = coalesce(p_checkpoint, checkpoint), updated_at = now() where id = t.id;
  update office.budget_reservations set status = 'released' where task_run_id = t.id and attempt = t.attempts and status = 'reserved';
  perform office.emit(t.org_id, 'task.progress', p_stage, t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.office_worker_defer(text,uuid,uuid,int,text,jsonb) from public;
grant execute on function public.office_worker_defer(text,uuid,uuid,int,text,jsonb) to anon, authenticated;
