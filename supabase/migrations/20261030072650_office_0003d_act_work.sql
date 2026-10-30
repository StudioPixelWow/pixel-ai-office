-- applied migration: office_0003d_act_work (version 20261030072650)
create or replace function office.act_work(m office.memberships, p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path = office, public, extensions as $$
declare r jsonb := '{}'::jsonb; v_id uuid; v_client uuid; v_old jsonb; v_req uuid; v_wf uuid; rec record; d office.message_drafts;
begin
  case p_action
  when 'create_content_item' then
    v_client := (p->>'client_id')::uuid;
    if not office.can_client(m, v_client) then raise exception 'forbidden:client'; end if;
    insert into office.content_items(org_id, client_id, project_id, period_id, entitlement_id, is_addon, goal, audience, topic, message, format, channel, due_at, brief, owner_agent)
    values (m.org_id, v_client, nullif(p->>'project_id','')::uuid, nullif(p->>'period_id','')::uuid, nullif(p->>'entitlement_id','')::uuid, coalesce((p->>'is_addon')::boolean, p->>'entitlement_id' is null),
      p->>'goal', p->>'audience', p->>'topic', p->>'message', p->>'format', p->>'channel', nullif(p->>'due_at','')::timestamptz, p->>'brief', p->>'owner_agent') returning id into v_id;
    if nullif(p->>'entitlement_id','') is not null and nullif(p->>'period_id','') is not null then
      insert into office.quota_allocations(period_id, entitlement_id, content_item_id) values ((p->>'period_id')::uuid, (p->>'entitlement_id')::uuid, v_id) on conflict (content_item_id) do nothing;
    end if;
    r := jsonb_build_object('id', v_id);
  when 'move_content_item' then
    select to_jsonb(c) into v_old from office.content_items c where id = (p->>'id')::uuid and org_id = m.org_id;
    if v_old is null or not office.can_client(m, (v_old->>'client_id')::uuid) then raise exception 'not_found'; end if;
    if (p ? 'version') and (v_old->>'version')::int <> (p->>'version')::int then raise exception 'conflict:content_item_changed'; end if;
    update office.content_items set due_at = (p->>'due_at')::timestamptz, version = version + 1, updated_at = now() where id = (p->>'id')::uuid;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'content_item',p->>'id',jsonb_build_object('due_at',v_old->'due_at'),jsonb_build_object('due_at',p->'due_at'));
    perform office.emit(m.org_id,'content.moved','מועד פריט עודכן',null,null,null,null,(v_old->>'client_id')::uuid,jsonb_build_object('content_item_id',p->>'id'));
  when 'assign_task' then
    v_client := nullif(p->>'client_id','')::uuid;
    if v_client is null and m.role not in ('owner','admin') then raise exception 'forbidden:office_scope'; end if;
    if v_client is not null and not office.can_project(m, v_client, nullif(p->>'project_id','')::uuid) then raise exception 'forbidden:client'; end if;
    if not exists(select 1 from office.agent_definitions where id = p->>'agent_id' and status = 'active') then raise exception 'agent_not_active'; end if;
    insert into office.requests(org_id, source, mode, text, client_id, project_id, scope, status, created_by, idempotency_key)
    values (m.org_id, 'manual', 'work', p->>'instruction', v_client, nullif(p->>'project_id','')::uuid, case when v_client is null then 'pixel' else 'client' end, 'running', m.user_id, p->>'idempotency_key')
    on conflict (org_id, idempotency_key) do nothing returning id into v_req;
    if v_req is null then select id into v_req from office.requests where org_id = m.org_id and idempotency_key = p->>'idempotency_key'; return jsonb_build_object('request_id', v_req, 'duplicate', true); end if;
    v_wf := office.instantiate_workflow(m.org_id, v_req, 'single_agent', v_client, nullif(p->>'project_id','')::uuid,
      jsonb_build_object('instruction', p->>'instruction'), 'req:'||v_req, null, p->>'agent_id', null);
    r := jsonb_build_object('request_id', v_req, 'workflow_run_id', v_wf);
  when 'create_request' then
    v_client := nullif(p->>'client_id','')::uuid;
    if v_client is not null and not office.can_project(m, v_client, nullif(p->>'project_id','')::uuid) then raise exception 'forbidden:client'; end if;
    if v_client is null and m.role not in ('owner','admin') then raise exception 'forbidden:office_scope'; end if;
    if coalesce(p->>'scope','client') = 'all_active_clients' and m.role not in ('owner','admin') then raise exception 'forbidden:scope'; end if;
    insert into office.requests(org_id, source, mode, text, client_id, project_id, scope, status, plan, created_by, idempotency_key)
    values (m.org_id, 'manual', coalesce(p->>'mode','work'), p->>'text', v_client, nullif(p->>'project_id','')::uuid,
      coalesce(nullif(p->>'scope',''), case when v_client is null then 'pixel' else 'client' end), 'planning', coalesce(p->'plan','{}'::jsonb), m.user_id, p->>'idempotency_key')
    on conflict (org_id, idempotency_key) do nothing returning id into v_req;
    if v_req is null then
      select id into v_req from office.requests where org_id = m.org_id and idempotency_key = p->>'idempotency_key';
      return jsonb_build_object('request_id', v_req, 'duplicate', true);
    end if;
    r := office.route_request(v_req) || jsonb_build_object('request_id', v_req);
  when 'cancel_run' then
    if p ? 'request_id' then
      update office.requests set status = 'cancelled', updated_at = now() where id = (p->>'request_id')::uuid and org_id = m.org_id;
      update office.workflow_runs set status = 'cancelled', updated_at = now() where request_id = (p->>'request_id')::uuid and status in ('running','paused','blocked');
      update office.task_runs set status = 'cancelled', updated_at = now(), stage = 'בוטל' where request_id = (p->>'request_id')::uuid
        and status in ('queued','retrying','waiting_input','waiting_connection','waiting_local','waiting_approval');
    end if;
    if p ? 'workflow_run_id' then
      update office.workflow_runs set status = 'cancelled', updated_at = now() where id = (p->>'workflow_run_id')::uuid and org_id = m.org_id;
      update office.task_runs set status = 'cancelled', updated_at = now(), stage = 'בוטל' where workflow_run_id = (p->>'workflow_run_id')::uuid
        and status in ('queued','retrying','waiting_input','waiting_connection','waiting_local','waiting_approval');
    end if;
    if p ? 'task_run_id' then
      update office.task_runs set status = 'cancelled', updated_at = now(), stage = 'בוטל' where id = (p->>'task_run_id')::uuid and org_id = m.org_id
        and status in ('queued','retrying','waiting_input','waiting_connection','waiting_local','waiting_approval');
    end if;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'run',coalesce(p->>'request_id',p->>'workflow_run_id',p->>'task_run_id'),null,p);
    perform office.emit(m.org_id,'run.cancelled','ריצה בוטלה — תוצרים שכבר הופקו נשמרו');
    r := jsonb_build_object('note','בוטל. שלבים חדשים לא יתחילו; שלב שכבר רץ אצל ספק עשוי להסתיים ולחייב; תוצרים קיימים נשמרו.');
  when 'pause_request' then
    update office.requests set status = 'paused', updated_at = now() where id = (p->>'request_id')::uuid and org_id = m.org_id;
    update office.workflow_runs set status = 'paused', updated_at = now() where request_id = (p->>'request_id')::uuid and status = 'running';
  when 'resume_request' then
    update office.requests set status = 'running', updated_at = now() where id = (p->>'request_id')::uuid and org_id = m.org_id and status = 'paused';
    update office.workflow_runs set status = 'running', updated_at = now() where request_id = (p->>'request_id')::uuid and status = 'paused';
  when 'retry_task' then
    select * into rec from office.task_runs where id = (p->>'task_run_id')::uuid and org_id = m.org_id;
    if rec.id is null then raise exception 'not_found'; end if;
    if rec.status not in ('failed','waiting_connection','waiting_local','waiting_input','uncertain') then raise exception 'not_retryable_in_status:%', rec.status; end if;
    if exists(select 1 from office.provider_jobs j where j.task_run_id = rec.id and j.status in ('submitted','processing','unknown')) then raise exception 'provider_job_pending_check_status_first'; end if;
    update office.task_runs set status = 'queued', blocker = null, next_attempt_at = now(), max_attempts = greatest(max_attempts, attempts + 1),
      stage = 'בתור (ניסיון חוזר)', updated_at = now() where id = rec.id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'task_run',rec.id::text,null,null);
  when 'set_kill_switch' then
    insert into office.kill_switches(org_id, scope_type, scope_ref, active, reason, set_by) values (m.org_id, p->>'scope_type', p->>'scope_ref', (p->>'active')::boolean, p->>'reason', m.user_id)
    on conflict (org_id, scope_type, scope_ref) do update set active = excluded.active, reason = excluded.reason, set_by = excluded.set_by, set_at = now();
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'kill_switch',(p->>'scope_type')||':'||(p->>'scope_ref'),null,p);
    perform office.emit(m.org_id,'kill_switch', case when (p->>'active')::boolean then 'עצירה הופעלה: ' else 'עצירה בוטלה: ' end || (p->>'scope_type'));
  when 'approve_artifact' then
    select v.*, a.client_id, a.org_id as a_org, a.content_item_id into rec from office.artifact_versions v join office.artifacts a on a.id = v.artifact_id where v.id = (p->>'version_id')::uuid;
    if rec.id is null or rec.a_org <> m.org_id then raise exception 'not_found'; end if;
    if rec.needs_update then raise exception 'version_needs_update:%', rec.needs_update_reason; end if;
    update office.artifact_versions set review_status = 'approved', approved_by = m.user_id, approved_at = now() where id = rec.id;
    insert into office.reviews(artifact_version_id, approval_kind, decision, comment, decided_by) values (rec.id, coalesce(p->>'approval_kind','general'), 'approved', p->>'comment', m.user_id);
    update office.task_runs set status = 'done', stage = 'אושר', finished_at = now(), updated_at = now()
      where status = 'waiting_approval' and inputs->>'kind' = 'gate:artifact' and inputs->'awaiting_versions' ? rec.id::text;
    if rec.content_item_id is not null and not exists(select 1 from office.task_runs where content_item_id = rec.content_item_id and status = 'waiting_approval') then
      update office.content_items set production_status = 'approved', approval_status = 'approved', updated_at = now() where id = rec.content_item_id;
      update office.quota_allocations set state = 'delivered', updated_at = now() where content_item_id = rec.content_item_id;
    end if;
    perform office.finish_check(wr.id) from office.task_runs tr join office.workflow_runs wr on wr.id = tr.workflow_run_id where tr.inputs->'awaiting_versions' ? rec.id::text;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'artifact_version',rec.id::text,null,p);
    perform office.emit(m.org_id,'artifact.approved','תוצר אושר',null,null,null,null,rec.client_id);
  when 'request_revision' then
    select v.*, a.client_id, a.org_id as a_org, a.content_item_id into rec from office.artifact_versions v join office.artifacts a on a.id = v.artifact_id where v.id = (p->>'version_id')::uuid;
    if rec.id is null or rec.a_org <> m.org_id or not office.can_client(m, rec.client_id) then raise exception 'not_found'; end if;
    if rec.review_status = 'approved' then raise exception 'approved_version_is_immutable_create_new'; end if;
    update office.artifact_versions set review_status = 'changes_requested' where id = rec.id;
    insert into office.reviews(artifact_version_id, approval_kind, decision, comment, decided_by) values (rec.id, coalesce(p->>'approval_kind','general'), 'changes_requested', p->>'comment', m.user_id);
    update office.task_runs set status = 'queued', blocker = null, next_attempt_at = now(), max_attempts = attempts + 2,
      inputs = inputs || jsonb_build_object('revision', jsonb_build_object('of_version', rec.id, 'comment', p->>'comment')), stage = 'תיקון לפי משוב', updated_at = now()
      where id = rec.task_run_id and status in ('done','waiting_approval');
    update office.task_runs set status = 'queued', depends_on = array[rec.task_run_id], stage = 'ממתין לגרסה מתוקנת', updated_at = now()
      where status = 'waiting_approval' and inputs->>'kind' = 'gate:artifact' and inputs->'awaiting_versions' ? rec.id::text;
    if rec.content_item_id is not null then update office.content_items set production_status = 'changes_requested', updated_at = now() where id = rec.content_item_id; end if;
    perform office.emit(m.org_id,'artifact.revision','נדרש תיקון',rec.task_run_id,null,null,null,rec.client_id);
  when 'prepare_message' then
    select * into rec from office.contacts where id = (p->>'contact_id')::uuid and org_id = m.org_id;
    if rec.id is null then raise exception 'contact_not_found'; end if;
    if rec.client_id is not null and not office.can_client(m, rec.client_id) then raise exception 'forbidden:client'; end if;
    if rec.phone_e164 is null then raise exception 'contact_has_no_phone'; end if;
    insert into office.message_drafts(org_id, client_id, project_id, lead_id, conversation_id, contact_id, sender_connection_id, recipient_e164,
      kind, reason, context_excerpt, body, attachments, business_ref_type, business_ref_id, status, scheduled_for, is_test, conv_last_message_id, snapshot_hash, review_reason)
    values (m.org_id, rec.client_id, nullif(p->>'project_id','')::uuid, rec.lead_id, (select id from office.conversations where contact_id = rec.id order by created_at desc limit 1),
      rec.id, coalesce(nullif(p->>'sender_connection_id','')::uuid, (select id from office.connections where org_id = m.org_id and provider in ('whatsapp_cloud','whatsapp_sandbox') and disconnected_at is null order by (provider='whatsapp_cloud') desc limit 1)),
      rec.phone_e164, coalesce(p->>'kind','reply'), p->>'reason', p->>'context_excerpt', p->>'body', office.resolve_attachments(p->'attachment_version_ids'),
      p->>'business_ref_type', nullif(p->>'business_ref_id','')::uuid,
      case when nullif(p->>'scheduled_for','')::timestamptz > now() then 'draft'::office.msg_status else 'pending_approval'::office.msg_status end,
      nullif(p->>'scheduled_for','')::timestamptz, rec.is_test, (select last_message_id from office.conversations where contact_id = rec.id order by created_at desc limit 1), 'x',
      case when not rec.phone_verified then 'המספר אינו מסומן כמאומת בתיק הקשר' end) returning id into v_id;
    r := jsonb_build_object('id', v_id, 'note', 'הטיוטה נכנסה לתור האישורים. שום הודעה לא תישלח בלי ״אשר ושלח״ שלך.');
  when 'draft_decision' then
    select * into d from office.message_drafts where id = (p->>'draft_id')::uuid and org_id = m.org_id for update;
    if d.id is null then raise exception 'not_found'; end if;
    if d.status not in ('pending_approval','needs_review','saved_later','draft','failed') then raise exception 'not_in_decidable_status:%', d.status; end if;
    if p->>'decision' = 'cancel' then update office.message_drafts set status = 'cancelled' where id = d.id;
    elsif p->>'decision' = 'save_later' then update office.message_drafts set status = 'saved_later' where id = d.id;
    elsif p->>'decision' = 'back_to_queue' then update office.message_drafts set status = 'pending_approval', review_reason = null where id = d.id;
    elsif p->>'decision' = 'request_rewrite' then
      update office.message_drafts set status = 'needs_review', review_reason = 'בקשת ניסוח אחר: '||coalesce(p->>'note','') where id = d.id;
      v_wf := office.instantiate_workflow(m.org_id, null, 'single_agent', d.client_id, d.project_id,
        jsonb_build_object('instruction', 'נסח מחדש את ההודעה לפי ההערה: '||coalesce(p->>'note','')||E'\nהנוסח הקודם:\n'||d.body, 'rewrite_draft_id', d.id),
        'rewrite:'||d.id||':'||d.draft_version, null, 'comms_manager', 'ניסוח מחדש');
    else raise exception 'bad_decision'; end if;
    perform office.audit(m.org_id,'user',m.user_id::text,'draft_'||(p->>'decision'),'message_draft',d.id::text,null,p);
  else
    return '"__nohandle"'::jsonb;
  end case;
  return r;
end $$;
