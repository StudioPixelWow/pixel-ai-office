-- applied migration: office_0009_acceptance_fn (version 20261030080042)
-- Acceptance suite as a function. It always ends with RAISE, so the whole run is rolled back.
create or replace function office.run_acceptance_tests() returns void language plpgsql set search_path = office, public, extensions as $$
declare
  res jsonb := '[]'::jsonb; org uuid; owner_id uuid := gen_random_uuid(); admin_id uuid := gen_random_uuid(); am_id uuid := gen_random_uuid();
  cA uuid; cB uuid; ctA uuid; ctB uuid; conv uuid; sbx uuid; d1 uuid; d2 uuid; r jsonb; v_hash text; v_ver int; n int; ok boolean;
  pr uuid; en uuid; per1 jsonb; per2 jsonb; wf uuid; t record; lease uuid; art uuid; av1 uuid; dep uuid; auto uuid; ts timestamptz; procedure_ok text; S text := 'acceptance-test-secret';
begin
  select id into org from office.organizations order by created_at limit 1;
  update office.system_secrets set sha256 = encode(extensions.digest(S,'sha256'),'hex') where name = 'worker';
  insert into office.agent_definitions(id, org_id, name, role_title, department)
    select distinct x, org, x, x, 'management' from (select st->>'agent' x from office.workflow_templates w, jsonb_array_elements(w.steps) st
      union select unnest(array['account_manager','comms_manager','community_manager','creator','article_writer','video_editor','crm_followup'])) q where x is not null
    on conflict do nothing;
  insert into office.memberships(org_id, user_id, email, role) values (org, owner_id, 'test-owner@example.test', 'owner'), (org, admin_id, 'test-admin@example.test', 'admin'), (org, am_id, 'test-am@example.test', 'account_manager');
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role', 'authenticated')::text, true); perform set_config('request.jwt.claim.sub', owner_id::text, true);
  cA := (public.office_action('create_client', '{"name":"[TEST] לקוח א","is_test":true,"status":"active"}')->>'id')::uuid;
  cB := (public.office_action('create_client', '{"name":"[TEST] לקוח ב","is_test":true,"status":"active"}')->>'id')::uuid;
  ctA := (public.office_action('create_contact', jsonb_build_object('client_id', cA, 'name', 'בדיקה א', 'phone_e164', '+972500000099', 'is_test', true))->>'id')::uuid;
  ctB := (public.office_action('create_contact', jsonb_build_object('client_id', cB, 'name', 'בדיקה ב', 'phone_e164', '+972500000098', 'is_test', true))->>'id')::uuid;
  perform public.office_action('verify_contact_phone', jsonb_build_object('id', ctA));
  insert into office.conversations(org_id, client_id, contact_id) values (org, cA, ctA) returning id into conv;
  insert into office.messages(conversation_id, direction, body, provider_message_id) values (conv, 'in', 'שלום', 'in-1');
  update office.conversations set last_message_id = (select id from office.messages where conversation_id = conv) where id = conv;
  d1 := (public.office_action('prepare_message', jsonb_build_object('contact_id', ctA, 'body', 'בדיקה 1', 'kind', 'followup'))->>'id')::uuid;
  select draft_version, snapshot_hash into v_ver, v_hash from office.message_drafts where id = d1;
  r := public.office_approve_and_send(d1, v_ver, v_hash, null);
  res := res || jsonb_build_object('t', 'T1 אין חשבון שולח מאומת → לא נשלח', 'pass', (r->>'ok')::boolean = false and not exists(select 1 from office.outbox_dispatches where draft_id = d1));
  insert into office.connections(org_id, provider, label, access_method, office_scope, status) values (org, 'whatsapp_sandbox', 'sandbox', 'builtin', true, 'action_tested') returning id into sbx;
  insert into office.connection_capabilities(connection_id, capability, implemented, status) values (sbx, 'send_message', true, 'action_tested');
  update office.message_drafts set sender_connection_id = sbx where id = d1;
  select draft_version, snapshot_hash into v_ver, v_hash from office.message_drafts where id = d1;
  r := public.office_approve_and_send(d1, v_ver, v_hash, null);
  res := res || jsonb_build_object('t', 'T2 חשבון בדיקה שולח רק למספר בדיקה מאושר', 'pass', (r->>'ok')::boolean = false and r->>'reason' like '%מספר בדיקה%');
  perform public.office_action('set_test_numbers', '{"numbers":["+972500000099"]}');
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id)::text, true); perform set_config('request.jwt.claim.sub', admin_id::text, true);
  begin perform public.office_approve_and_send(d1, v_ver, v_hash, null); ok := false; exception when others then ok := sqlerrm like '%only_owner%'; end;
  res := res || jsonb_build_object('t', 'T3 מנהל מערכת אינו יכול לאשר הודעה', 'pass', ok);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id)::text, true); perform set_config('request.jwt.claim.sub', owner_id::text, true);
  begin perform public.office_approve_and_send(d1, v_ver, 'not-the-hash', null); ok := false; exception when others then ok := sqlerrm like '%snapshot_changed%'; end;
  res := res || jsonb_build_object('t', 'T4 snapshot שהשתנה נדחה', 'pass', ok);
  r := public.office_approve_and_send(d1, v_ver, v_hash, 'בדיקה 1 — נוסח ערוך');
  begin perform public.office_approve_and_send(d1, v_ver, v_hash, null); ok := false; exception when others then ok := sqlerrm like '%not_pending%' or sqlerrm like '%snapshot%'; end;
  select count(*) into n from office.outbox_dispatches where draft_id = d1;
  res := res || jsonb_build_object('t', 'T5 אישור יחיד → dispatch יחיד; לחיצה כפולה נדחית; עריכה מאשרת את הנוסח המוצג', 'pass', coalesce((r->>'ok')::boolean,false) and ok and n = 1
    and (select body from office.message_drafts where id = d1) = 'בדיקה 1 — נוסח ערוך'
    and (select draft_version from office.message_approvals where draft_id = d1) = (select draft_version from office.message_drafts where id = d1));
  insert into office.messages(conversation_id, direction, body, provider_message_id) values (conv, 'in', 'תשובה חדשה', 'in-2');
  update office.conversations set last_message_id = (select id from office.messages where provider_message_id = 'in-2') where id = conv;
  r := public.office_worker_outbox_claim(S, 5);
  res := res || jsonb_build_object('t', 'T6 תשובה חדשה עוצרת פולואפ שהתיישן', 'pass', jsonb_array_length(r) = 0
    and (select status from office.outbox_dispatches where draft_id = d1) = 'aborted' and (select status::text from office.message_drafts where id = d1) = 'needs_review');
  d2 := (public.office_action('prepare_message', jsonb_build_object('contact_id', ctA, 'body', 'בדיקה 2', 'sender_connection_id', sbx))->>'id')::uuid;
  select draft_version, snapshot_hash into v_ver, v_hash from office.message_drafts where id = d2;
  r := public.office_approve_and_send(d2, v_ver, v_hash, null);
  r := public.office_worker_outbox_claim(S, 5);
  update office.outbox_dispatches set claimed_until = now() - interval '1 minute' where draft_id = d2;
  r := public.office_worker_outbox_claim(S, 5);
  res := res || jsonb_build_object('t', 'T7 תוצאת ספק לא ידועה → לא ודאי, בלי ניסיון עיוור', 'pass', jsonb_array_length(r) = 0
    and (select status from office.outbox_dispatches where draft_id = d2) = 'uncertain' and (select status::text from office.message_drafts where id = d2) = 'uncertain'
    and (select consumed_at is not null from office.message_approvals where draft_id = d2));
  update office.message_drafts set status = 'pending_approval', conv_last_message_id = (select last_message_id from office.conversations where id = conv) where id = d1;
  select draft_version, snapshot_hash into v_ver, v_hash from office.message_drafts where id = d1;
  r := public.office_approve_and_send(d1, v_ver, v_hash, null);
  update office.message_approvals set expires_at = now() - interval '1 second' where draft_id = d1 and consumed_at is null;
  r := public.office_worker_outbox_claim(S, 5);
  res := res || jsonb_build_object('t', 'T8 אישור שפג תוקפו אינו שמיש', 'pass', jsonb_array_length(r) = 0 and (select status::text from office.message_drafts where id = d1) = 'needs_review');
  d2 := (public.office_action('prepare_message', jsonb_build_object('contact_id', ctA, 'body', 'תזכורת', 'kind', 'reminder', 'sender_connection_id', sbx, 'scheduled_for', now() + interval '1 hour'))->>'id')::uuid;
  update office.message_drafts set scheduled_for = now() - interval '1 minute' where id = d2;
  r := public.office_worker_claim(S, 'test', 0);
  res := res || jsonb_build_object('t', 'T9 תזמון מכין לאישור ולא שולח', 'pass', (select status::text from office.message_drafts where id = d2) = 'pending_approval' and not exists(select 1 from office.outbox_dispatches where draft_id = d2));
  pr := (public.office_action('create_proposal', '{"title":"[TEST] הצעה"}')->>'id')::uuid;
  perform public.office_action('set_price', jsonb_build_object('proposal_id', pr, 'setup', 2500, 'monthly', 4200, 'media_budget', 3000));
  begin update office.proposals set locked_monthly = 1 where id = pr; ok := false; exception when others then ok := sqlerrm like '%locked_price_change_rejected%'; end;
  perform public.office_action('create_proposal_version', jsonb_build_object('proposal_id', pr, 'content', '{"need":"בדיקה"}'));
  perform public.office_action('set_price', jsonb_build_object('proposal_id', pr, 'setup', 2600, 'monthly', 4200, 'media_budget', 3000, 'reason', 'עדכון'));
  begin perform public.office_action('approve_proposal', jsonb_build_object('version_id', (select id from office.proposal_versions where proposal_id = pr and version_no = 1))); procedure_ok := 'approved';
  exception when others then procedure_ok := sqlerrm; end;
  res := res || jsonb_build_object('t', 'T10 מחיר נעול נאכף, שינוי נשמר כגרסה, מדיה נפרדת', 'pass', ok and (select count(*) from office.proposal_price_history where proposal_id = pr) = 2 and procedure_ok like '%price_snapshot_differs%'
    and (select (totals->>'media_budget_separate')::numeric from office.proposal_versions where proposal_id = pr and version_no = 1) = 3000);
  insert into office.client_access(org_id, user_id, client_id) values (org, am_id, cA);
  perform set_config('request.jwt.claims', json_build_object('sub', am_id)::text, true); perform set_config('request.jwt.claim.sub', am_id::text, true);
  ok := jsonb_array_length(public.office_list('contacts', jsonb_build_object('client_id', cB))) = 0 and jsonb_array_length(public.office_list('contacts', jsonb_build_object('client_id', cA))) = 1
        and not exists(select 1 from jsonb_array_elements(public.office_list('clients', '{}')) x where (x->>'id')::uuid = cB);
  begin perform public.office_list('connections', '{}'); ok := ok and false; exception when others then ok := ok and sqlerrm like '%forbidden%'; end;
  begin perform public.office_action('create_contact', jsonb_build_object('client_id', cB, 'name', 'x')); ok := ok and false; exception when others then ok := ok and sqlerrm like '%forbidden%'; end;
  res := res || jsonb_build_object('t', 'T11 משתמש של לקוח א לא רואה ולא פועל על לקוח ב', 'pass', ok);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id)::text, true); perform set_config('request.jwt.claim.sub', owner_id::text, true);
  insert into office.engagements(org_id, client_id, status, start_date, confirmed_by, confirmed_at) values (org, cA, 'active', current_date, owner_id, now()) returning id into en;
  insert into office.service_entitlements(org_id, engagement_id, service_key, title, unit, quantity_per_period) values (org, en, 'social_post', 'פוסט', 'post', 8), (org, en, 'reel_video', 'סרטון', 'video', 2);
  per1 := public.office_action('open_service_period', jsonb_build_object('engagement_id', en, 'month', '2026-12-01'));
  per2 := public.office_action('open_service_period', jsonb_build_object('engagement_id', en, 'month', '2026-12-15'));
  res := res || jsonb_build_object('t', 'T12a פתיחת תקופה פעמיים → תקופה אחת', 'pass', per1->>'id' = per2->>'id' and coalesce((per2->>'already_open')::boolean,false));
  wf := office.instantiate_workflow(org, null, 'monthly_plan_client', cA, null, jsonb_build_object('month','2026-12-01','engagement_id', en), 'monthly:'||en||':2026-12-01');
  perform office.instantiate_workflow(org, null, 'monthly_plan_client', cA, null, jsonb_build_object('month','2026-12-01','engagement_id', en), 'monthly:'||en||':2026-12-01');
  select count(*) into n from office.workflow_runs where idempotency_key = 'monthly:'||en||':2026-12-01';
  res := res || jsonb_build_object('t', 'T12b הפעלה כפולה → תהליך אחד', 'pass', n = 1);
  select * into t from office.task_runs where workflow_run_id = wf and step_key = 'period';
  update office.task_runs set status = 'running', lease_token = gen_random_uuid() where id = t.id returning lease_token into lease;
  perform public.office_worker_system_step(S, t.id, lease, '{}');
  update office.task_runs set status = 'done' where workflow_run_id = wf and step_key = 'research';
  select * into t from office.task_runs where workflow_run_id = wf and step_key = 'gantt';
  update office.task_runs set status = 'running', lease_token = gen_random_uuid() where id = t.id returning lease_token into lease;
  perform public.office_worker_system_step(S, t.id, lease, '{}');
  update office.task_runs set status = 'running', lease_token = gen_random_uuid() where id = t.id returning lease_token into lease;
  perform public.office_worker_system_step(S, t.id, lease, '{}');
  select count(*) into n from office.content_items where period_id = (per1->>'id')::uuid;
  res := res || jsonb_build_object('t', 'T12c גאנט = בדיוק 8 פוסטים + 2 סרטונים גם בהרצה חוזרת', 'pass', n = 10 and (select count(*) from office.quota_allocations where period_id = (per1->>'id')::uuid) = 10
    and (select count(*) from office.workflow_runs where workflow_key = 'video_production' and client_id = cA) = 2
    and (select count(*) from office.workflow_runs where workflow_key = 'content_item' and client_id = cA) = 8, 'items', n);
  select count(*) into n from jsonb_array_elements(public.office_quota((per1->>'id')::uuid)) q where (q->>'available')::numeric = 0;
  res := res || jsonb_build_object('t', 'T12d יתרת מכסה בלי ספירה כפולה', 'pass', n = 2);
  begin perform public.office_worker_complete(S, t.id, gen_random_uuid(), '{}'); ok := false; exception when others then ok := sqlerrm like '%stale_lease%'; end;
  res := res || jsonb_build_object('t', 'T13 worker כפול/משוחזר לא יכול להשלים (stale lease)', 'pass', ok);
  art := (office.add_artifact_version(org, cA, null, null, null, 'copy', 'קופי', 'v1', null, 'copywriter', null, null, null, null, null)).artifact_id;
  av1 := (select id from office.artifact_versions where artifact_id = art and version_no = 1);
  dep := (office.add_artifact_version(org, cA, null, null, null, 'design', 'עיצוב', 'design v1', null, 'graphic_designer', null, null, null, array[av1], null)).id;
  perform office.add_artifact_version(org, cA, null, null, art, 'copy', 'קופי', 'v2', null, 'copywriter', null, null, null, null, 'תיקון כותרת');
  perform public.office_action('approve_artifact', jsonb_build_object('version_id', (select id from office.artifact_versions where artifact_id = art and version_no = 2)));
  begin update office.artifact_versions set body = 'x' where artifact_id = art and version_no = 2; ok := false; exception when others then ok := sqlerrm like '%immutable%'; end;
  res := res || jsonb_build_object('t', 'T14 תיקון קופי מסמן עיצוב תלוי; גרסה מאושרת לא נדרסת', 'pass', ok and (select needs_update from office.artifact_versions where id = dep));
  perform public.office_action('cancel_run', jsonb_build_object('workflow_run_id', wf));
  select count(*) into n from jsonb_array_elements(public.office_worker_claim(S, 'test', 10)) x where (x->'task'->>'workflow_run_id')::uuid = wf;
  res := res || jsonb_build_object('t', 'T15 ביטול מונע שלבים חדשים ושומר תוצרים', 'pass', n = 0 and (select count(*) from office.content_items where period_id = (per1->>'id')::uuid) = 10);
  auto := (public.office_action('upsert_automation', '{"name":"[TEST] monthly","trigger_type":"schedule","schedule_kind":"monthly_day","schedule_day":1,"schedule_time":"08:30","client_scope":"none","workflow_key":"single_agent","params":{"instruction":"בדיקה"}}')->>'id')::uuid;
  perform public.office_action('set_automation_status', jsonb_build_object('id', auto, 'status', 'active'));
  update office.automations set next_run_at = now() - interval '1 minute' where id = auto;
  perform public.office_worker_tick_automations(S);
  update office.automations set next_run_at = now() - interval '1 minute' where id = auto;
  perform public.office_worker_tick_automations(S);
  select count(*) into n from office.requests where idempotency_key like 'auto:'||auto||':%';
  select next_run_at into ts from office.automations where id = auto;
  res := res || jsonb_build_object('t', 'T16 תזמון כפול → בקשה אחת; ריצה הבאה 08:30 Asia/Jerusalem', 'pass', n = 1 and to_char(ts at time zone 'Asia/Jerusalem', 'HH24:MI') = '08:30' and extract(day from ts at time zone 'Asia/Jerusalem') = 1, 'next', ts);
  update office.clients set status = 'active' where id in (cA, cB);
  r := public.office_action('create_request', jsonb_build_object('text', 'תכין את תוכנית העבודה לחודש הבא לכל הלקוחות הפעילים', 'scope', 'all_active_clients', 'idempotency_key', 'test-all'));
  res := res || jsonb_build_object('t', 'T17 פקודה לכל המשרד → תהליך לכל לקוח עם התקשרות בלבד', 'pass', exists(select 1 from jsonb_array_elements(r->'opened') o where o->>'client' = '[TEST] לקוח א') and not exists(select 1 from jsonb_array_elements(r->'opened') o where o->>'client' = '[TEST] לקוח ב'));
  ok := not exists(select 1 from pg_proc where proname like 'office_worker%approv%');
  res := res || jsonb_build_object('t', 'T18 אין יכולת אישור שחשופה ל-workers/סוכנים', 'pass', ok);
  raise exception 'ACCEPTANCE_RESULTS %', res;
end $$;
revoke all on function office.run_acceptance_tests() from public, anon, authenticated;
