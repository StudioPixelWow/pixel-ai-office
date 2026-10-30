-- applied migration: office_0004e_outbox_providers (version 20261030073311)
create or replace function public.office_worker_prepare_message(p_secret text, p_task uuid, p_lease uuid, p_msg jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs; c office.contacts; v_id uuid; conv office.conversations; v_sender uuid;
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  select * into c from office.contacts where id = nullif(p_msg->>'contact_id','')::uuid and archived_at is null;
  if c.id is null or c.client_id is distinct from t.client_id then raise exception 'contact_not_in_task_scope'; end if;
  if c.phone_e164 is null then raise exception 'contact_has_no_phone'; end if;
  select * into conv from office.conversations where contact_id = c.id order by created_at desc limit 1;
  select id into v_sender from office.connections where org_id = t.org_id and provider in ('whatsapp_cloud','whatsapp_sandbox') and disconnected_at is null
    and (office_scope or t.client_id = any(coalesce(allowed_client_ids,'{}'))) order by (provider = 'whatsapp_cloud') desc limit 1;
  insert into office.message_drafts(org_id, client_id, project_id, lead_id, conversation_id, contact_id, sender_connection_id, recipient_e164, kind, reason, context_excerpt,
    body, attachments, prepared_by_agent, task_run_id, business_ref_type, business_ref_id, conv_last_message_id, status, scheduled_for, is_test, snapshot_hash, review_reason)
  values (t.org_id, t.client_id, t.project_id, c.lead_id, conv.id, c.id, v_sender, c.phone_e164, coalesce(p_msg->>'kind','followup'), p_msg->>'reason',
    p_msg->>'context_excerpt', p_msg->>'body', office.resolve_attachments(p_msg->'attachment_version_ids'), t.agent_id, t.id, p_msg->>'business_ref_type',
    nullif(p_msg->>'business_ref_id','')::uuid, conv.last_message_id,
    case when nullif(p_msg->>'scheduled_for','')::timestamptz > now() then 'draft'::office.msg_status else 'pending_approval'::office.msg_status end,
    nullif(p_msg->>'scheduled_for','')::timestamptz, c.is_test, 'x', case when not c.phone_verified then 'המספר אינו מסומן כמאומת בתיק הקשר' end) returning id into v_id;
  insert into office.notifications(org_id, kind, title, link) values (t.org_id, 'approval', 'טיוטת הודעה ממתינה לאישורך', '/approvals?draft='||v_id);
  perform office.emit(t.org_id, 'message.drafted', 'טיוטת הודעה ממתינה לאישור', t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
  return jsonb_build_object('draft_id', v_id);
end $$;

create or replace function public.office_worker_outbox_claim(p_secret text, p_max int default 5) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; o office.outbox_dispatches; ap office.message_approvals; d office.message_drafts; conv office.conversations; res jsonb := '[]'::jsonb; sc office.connections;
begin
  v_org := office.worker_org(p_secret);
  update office.outbox_dispatches set status = 'uncertain', last_error = 'לא התקבל דיווח מהשולח — ייתכן שהספק קיבל; לבדוק לפני ניסיון נוסף', updated_at = now()
   where status = 'claimed' and claimed_until < now();
  update office.message_drafts md set status = 'uncertain' from office.outbox_dispatches od where od.draft_id = md.id and od.status = 'uncertain' and md.status = 'sending';
  for o in select * from office.outbox_dispatches where status = 'queued' order by created_at limit p_max for update skip locked loop
    select * into ap from office.message_approvals where id = o.approval_id for update;
    select * into d from office.message_drafts where id = o.draft_id for update;
    if ap.consumed_at is not null or ap.expires_at < now() or d.draft_version <> ap.draft_version or d.snapshot_hash <> ap.snapshot_hash then
      update office.outbox_dispatches set status = 'aborted', last_error = 'האישור פג תוקף או שהטיוטה השתנתה', updated_at = now() where id = o.id;
      update office.message_drafts set status = 'needs_review', review_reason = 'האישור פג תוקף לפני השליחה — נדרש אישור מחדש' where id = d.id and status = 'sending';
      continue;
    end if;
    if d.conversation_id is not null then
      select * into conv from office.conversations where id = d.conversation_id;
      if conv.last_message_id is distinct from d.conv_last_message_id then
        update office.outbox_dispatches set status = 'aborted', last_error = 'התקבלה הודעה חדשה לפני השליחה', updated_at = now() where id = o.id;
        update office.message_drafts set status = 'needs_review', review_reason = 'התקבלה תשובה חדשה מהלקוח — ההקשר עודכן, נדרשת בדיקה' where id = d.id;
        continue;
      end if;
    end if;
    update office.message_approvals set consumed_at = now() where id = ap.id;
    update office.outbox_dispatches set status = 'claimed', attempts = attempts + 1, claimed_until = now() + interval '2 minutes', updated_at = now() where id = o.id;
    select * into sc from office.connections where id = d.sender_connection_id;
    res := res || jsonb_build_array(jsonb_build_object('dispatch_id', o.id, 'dispatch_key', o.dispatch_key, 'provider', sc.provider, 'secret_ref', sc.secret_ref,
      'account', sc.account_identifier, 'to', d.recipient_e164, 'body', d.body, 'template_name', d.template_name, 'template_params', d.template_params,
      'attachments', d.attachments, 'draft_id', d.id));
  end loop;
  return res;
end $$;

create or replace function public.office_worker_outbox_result(p_secret text, p_dispatch uuid, p_outcome text, p_provider_id text, p_error text) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; o office.outbox_dispatches; d office.message_drafts; v_mid uuid;
begin
  v_org := office.worker_org(p_secret);
  select * into o from office.outbox_dispatches where id = p_dispatch for update;
  if o.status not in ('claimed','uncertain') then return jsonb_build_object('ignored', true); end if;
  if p_outcome not in ('accepted','failed','uncertain') then raise exception 'bad_outcome'; end if;
  update office.outbox_dispatches set status = p_outcome, provider_message_id = p_provider_id, last_error = p_error, updated_at = now() where id = o.id;
  update office.message_drafts set status = p_outcome::office.msg_status, review_reason = case when p_outcome = 'failed' then p_error else review_reason end
    where id = o.draft_id returning * into d;
  if p_outcome = 'accepted' and d.conversation_id is not null then
    insert into office.messages(conversation_id, direction, body, provider_message_id, status) values (d.conversation_id, 'out', d.body, p_provider_id, 'accepted') on conflict do nothing returning id into v_mid;
    -- our own outgoing message moves the head so that stale drafts against the old head are re-checked
    update office.conversations set last_message_id = coalesce(v_mid, last_message_id) where id = d.conversation_id;
  end if;
  perform office.audit(d.org_id, 'worker', 'outbox', 'dispatch_'||p_outcome, 'message_draft', d.id::text, null, jsonb_build_object('provider_id', p_provider_id, 'error', p_error));
  perform office.emit(d.org_id, 'message.'||p_outcome, case p_outcome when 'accepted' then 'ההודעה התקבלה אצל הספק' when 'failed' then 'שליחה נכשלה' else 'סטטוס לא ודאי' end, null, null, null, 'comms_manager', d.client_id);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.office_worker_connection_report(p_secret text, p_provider text, p_label text, p_secret_ref text, p_caps jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; v_id uuid; c jsonb; v_best text;
begin
  v_org := office.worker_org(p_secret);
  select id into v_id from office.connections where org_id = v_org and provider = p_provider and access_method = 'builtin' and disconnected_at is null limit 1;
  if v_id is null then
    insert into office.connections(org_id, provider, label, access_method, office_scope, secret_ref, status) values (v_org, p_provider, p_label, 'builtin', true, p_secret_ref, 'pending_setup') returning id into v_id;
  end if;
  for c in select * from jsonb_array_elements(p_caps) loop
    insert into office.connection_capabilities(connection_id, capability, implemented, status, permission_required, check_method, verified_account, verified_at)
    values (v_id, c->>'capability', (c->>'implemented')::boolean, (c->>'status')::office.conn_status, c->>'permission_required', c->>'check_method', c->>'account',
            case when (c->>'status') in ('access_verified','action_tested') then now() end)
    on conflict (connection_id, capability) do update set implemented = excluded.implemented, status = excluded.status, check_method = excluded.check_method,
      verified_account = excluded.verified_account, verified_at = coalesce(excluded.verified_at, office.connection_capabilities.verified_at);
    insert into office.connection_checks(connection_id, capability, ok, result, details) values (v_id, c->>'capability', (c->>'status') in ('access_verified','action_tested'), (c->>'status')::office.conn_status, c->>'details');
  end loop;
  select case when bool_or(status = 'action_tested') then 'action_tested' when bool_or(status = 'access_verified') then 'access_verified' else (p_caps->0->>'status') end
    into v_best from office.connection_capabilities where connection_id = v_id;
  update office.connections set status = v_best::office.conn_status, verified_at = case when v_best in ('access_verified','action_tested') then now() else verified_at end,
    last_error = case when v_best in ('access_verified','action_tested') then null else p_caps->0->>'details' end, label = p_label, updated_at = now() where id = v_id;
  return jsonb_build_object('connection_id', v_id, 'status', v_best);
end $$;

create or replace function public.office_provider_event(p_secret text, p_provider text, p_event_id text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; v_rank int; c office.contacts; conv office.conversations; v_mid uuid; v_new int;
begin
  v_org := office.worker_org(p_secret);
  insert into office.provider_events(provider, provider_event_id, payload) values (p_provider, p_event_id, p_payload) on conflict do nothing;
  if not found then return jsonb_build_object('duplicate', true); end if;
  if p_payload->>'type' = 'message_status' then
    v_new := case p_payload->>'status' when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 when 'failed' then 4 else 0 end;
    update office.message_drafts d set status = case p_payload->>'status' when 'delivered' then 'delivered'::office.msg_status when 'read' then 'read'::office.msg_status when 'failed' then 'failed'::office.msg_status else d.status end
      from office.outbox_dispatches o where o.draft_id = d.id and o.provider_message_id = p_payload->>'provider_message_id'
      and (case d.status when 'accepted' then 1 when 'delivered' then 2 when 'read' then 3 when 'failed' then 4 else 0 end) < v_new;
  elsif p_payload->>'type' = 'inbound_message' then
    select * into c from office.contacts where org_id = v_org and phone_e164 = p_payload->>'from' and archived_at is null order by phone_verified desc limit 1;
    if c.id is null then insert into office.contacts(org_id, name, phone_e164) values (v_org, coalesce(p_payload->>'profile_name','לא מזוהה'), p_payload->>'from') returning * into c; end if;
    insert into office.conversations(org_id, channel, client_id, lead_id, contact_id, sender_connection_id)
    values (v_org, 'whatsapp', c.client_id, c.lead_id, c.id, nullif(p_payload->>'connection_id','')::uuid) on conflict (channel, sender_connection_id, contact_id) do nothing;
    select * into conv from office.conversations where contact_id = c.id order by created_at desc limit 1;
    insert into office.messages(conversation_id, direction, body, provider_message_id, occurred_at) values (conv.id, 'in', p_payload->>'text', p_payload->>'provider_message_id', coalesce(nullif(p_payload->>'timestamp','')::timestamptz, now()))
    on conflict do nothing returning id into v_mid;
    update office.conversations set last_message_id = coalesce(v_mid, last_message_id), last_inbound_at = now(), service_window_until = now() + interval '24 hours' where id = conv.id;
    update office.message_drafts set status = 'needs_review', review_reason = 'התקבלה תשובה חדשה מהלקוח' where conversation_id = conv.id and status in ('pending_approval','draft','saved_later');
    if lower(coalesce(p_payload->>'text','')) ~ '^(stop|הסר|הפסק)' then update office.contacts set opted_out_at = now() where id = c.id; end if;
    if not conv.auto_paused then
      perform office.instantiate_workflow(v_org, null, 'single_agent', c.client_id, null,
        jsonb_build_object('instruction', 'התקבלה הודעה נכנסת. סווג אותה, עדכן הקשר והכן טיוטת תשובה לאישור (אל תאשר מחיר/חוזה/הרשאות): '||coalesce(p_payload->>'text',''), 'conversation_id', conv.id, 'contact_id', c.id),
        'inbound:'||p_event_id, null, 'community_manager', 'הודעה נכנסת');
    end if;
    perform office.fire_event(v_org, 'conversation.inbound', c.client_id, p_event_id, 'הודעה נכנסת');
  elsif p_payload->>'type' = 'job_status' then
    v_rank := case p_payload->>'status' when 'submitted' then 0 when 'processing' then 1 when 'succeeded' then 3 when 'failed' then 3 else 0 end;
    update office.provider_jobs set status = p_payload->>'status', status_rank = v_rank, result = coalesce(p_payload->'result', result),
      result_url = coalesce(p_payload->>'result_url', result_url), last_checked_at = now()
    where provider = p_provider and provider_job_id = p_payload->>'provider_job_id' and status_rank <= v_rank and status not in ('succeeded','failed');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.office_worker_provider_job(p_secret text, p_task uuid, p_lease uuid, p_op text, p_job jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs; j office.provider_jobs;
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  if p_op = 'get' then
    select * into j from office.provider_jobs where idempotency_key = p_job->>'idempotency_key';
    return coalesce(to_jsonb(j), 'null'::jsonb);
  elsif p_op = 'register' then
    insert into office.provider_jobs(org_id, connection_id, task_run_id, provider, idempotency_key, status)
    values (t.org_id, nullif(p_job->>'connection_id','')::uuid, t.id, p_job->>'provider', p_job->>'idempotency_key', 'unknown') on conflict (idempotency_key) do nothing;
    select * into j from office.provider_jobs where idempotency_key = p_job->>'idempotency_key';
    return to_jsonb(j);
  elsif p_op = 'update' then
    update office.provider_jobs set provider_job_id = coalesce(p_job->>'provider_job_id', provider_job_id), status = p_job->>'status',
      status_rank = greatest(status_rank, case p_job->>'status' when 'submitted' then 0 when 'processing' then 1 when 'succeeded' then 3 when 'failed' then 3 else 0 end),
      result = coalesce(p_job->'result', result), result_url = coalesce(p_job->>'result_url', result_url), last_checked_at = now()
    where idempotency_key = p_job->>'idempotency_key' and status not in ('succeeded','failed') returning * into j;
    return coalesce(to_jsonb(j), 'null'::jsonb);
  end if;
  raise exception 'bad_op';
end $$;

create or replace function public.office_worker_tick_automations(p_secret text) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; a office.automations; v_key text; v_req uuid; n int := 0; lnow timestamp;
begin
  v_org := office.worker_org(p_secret);
  for a in select * from office.automations where org_id = v_org and status = 'active' and trigger_type = 'schedule' and next_run_at <= now() for update skip locked loop
    lnow := now() at time zone a.timezone;
    v_key := case a.schedule_kind when 'monthly_day' then to_char(lnow, 'YYYY-MM') when 'weekly' then to_char(lnow, 'IYYY-IW') else to_char(lnow, 'YYYY-MM-DD') end;
    insert into office.automation_fires(automation_id, fire_key) values (a.id, v_key) on conflict do nothing;
    if found then
      insert into office.requests(org_id, source, mode, text, scope, status, plan, idempotency_key)
      values (v_org, 'schedule', 'work', coalesce(a.params->>'instruction', a.name), case when a.client_scope = 'all_active' then 'all_active_clients' else 'pixel' end, 'planning',
              a.params || jsonb_build_object('month', office.next_month_start(a.timezone), 'automation_id', a.id), 'auto:'||a.id||':'||v_key)
      on conflict (org_id, idempotency_key) do nothing returning id into v_req;
      if v_req is not null then
        update office.automation_fires set request_id = v_req where automation_id = a.id and fire_key = v_key;
        perform office.route_request(v_req);
        n := n + 1;
      end if;
    end if;
    update office.automations set last_run_at = now(), next_run_at = office.automation_next_run(a) where id = a.id;
  end loop;
  return jsonb_build_object('fired', n);
end $$;
