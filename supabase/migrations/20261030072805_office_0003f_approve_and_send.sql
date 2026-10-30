-- applied migration: office_0003f_approve_and_send (version 20261030072805)
create or replace function public.office_approve_and_send(p_draft uuid, p_version int, p_shown_hash text, p_body text)
returns jsonb language plpgsql security definer set search_path = office, public, extensions as $$
declare m office.memberships; d office.message_drafts; conv office.conversations; c office.contacts; sc office.connections;
  a jsonb; v_reason text; ap uuid; dk text; v_test_numbers jsonb;
begin
  m := office.ctx();
  if m.role <> 'owner' then raise exception 'only_owner_can_approve_messages' using errcode = '42501'; end if;
  select * into d from office.message_drafts where id = p_draft and org_id = m.org_id for update;
  if d.id is null then raise exception 'not_found'; end if;
  if d.status <> 'pending_approval' then raise exception 'not_pending:%', d.status; end if;
  if d.draft_version <> p_version or d.snapshot_hash <> p_shown_hash then
    raise exception 'snapshot_changed_reload' using detail = 'הטיוטה השתנתה מאז שהוצגה — רענן ובדוק שוב';
  end if;
  if p_body is not null and p_body is distinct from d.body then
    update office.message_drafts set body = p_body where id = d.id returning * into d;   -- new version+hash: the approval binds to exactly the shown text
  end if;
  select * into c from office.contacts where id = d.contact_id;
  if c.opted_out_at is not null then v_reason := 'איש הקשר ביקש להפסיק לקבל הודעות'; end if;
  if v_reason is null and c.phone_e164 is distinct from d.recipient_e164 then v_reason := 'המספר בתיק הקשר השתנה מאז הכנת הטיוטה'; end if;
  if v_reason is null and not c.phone_verified then v_reason := 'המספר אינו מאומת בתיק הקשר'; end if;
  if v_reason is null and d.conversation_id is not null then
    select * into conv from office.conversations where id = d.conversation_id;
    if conv.last_message_id is distinct from d.conv_last_message_id then v_reason := 'התקבלה הודעה חדשה בשיחה מאז הכנת הטיוטה'; end if;
    if v_reason is null and conv.auto_paused then v_reason := 'השיחה בטיפול ידני שלך — טיפול אוטומטי מושהה'; end if;
  end if;
  if v_reason is null and d.business_ref_type = 'meeting' and exists(select 1 from office.meetings where id = d.business_ref_id and status = 'cancelled') then v_reason := 'הפגישה בוטלה'; end if;
  if v_reason is null and d.business_ref_type = 'proposal' and exists(select 1 from office.proposals where id = d.business_ref_id and status in ('archived','declined','accepted')) then v_reason := 'ההצעה כבר אינה רלוונטית'; end if;
  if v_reason is null and d.created_at < now() - interval '7 days' then v_reason := 'הטיוטה ישנה משבוע — יש לבדוק שהיא עדיין רלוונטית'; end if;
  if v_reason is null then
    for a in select * from jsonb_array_elements(d.attachments) loop
      if not exists(select 1 from office.artifact_versions v where v.id = (a->>'artifact_version_id')::uuid and v.sha256 = a->>'sha256' and not v.needs_update) then
        v_reason := 'מצורף הוחלף או סומן כמיושן: '||coalesce(a->>'title','');
      end if;
    end loop;
  end if;
  if v_reason is not null then
    update office.message_drafts set status = 'needs_review', review_reason = v_reason where id = d.id;
    perform office.audit(m.org_id,'user',m.user_id::text,'approve_blocked','message_draft',d.id::text,null,jsonb_build_object('reason',v_reason));
    return jsonb_build_object('ok', false, 'status', 'needs_review', 'reason', v_reason);
  end if;
  select * into sc from office.connections where id = d.sender_connection_id;
  if sc.id is null or sc.disconnected_at is not null or sc.status not in ('access_verified','action_tested')
     or not exists(select 1 from office.connection_capabilities cc where cc.connection_id = sc.id and cc.capability = 'send_message' and cc.implemented and cc.status in ('access_verified','action_tested')) then
    return jsonb_build_object('ok', false, 'status', 'pending_approval', 'reason', 'אין חשבון שולח WhatsApp מאומת לטיוטה הזו — ההודעה נשארת ממתינה ולא נשלחה');
  end if;
  if sc.provider = 'whatsapp_sandbox' then
    select settings->'test_numbers' into v_test_numbers from office.organizations where id = m.org_id;
    if not (coalesce(v_test_numbers,'[]'::jsonb) ? d.recipient_e164) then
      return jsonb_build_object('ok', false, 'status', 'pending_approval', 'reason', 'חשבון בדיקה: מותר לשלוח רק למספר בדיקה שאישרת במפורש');
    end if;
  end if;
  insert into office.message_approvals(draft_id, draft_version, snapshot_hash, snapshot, approved_by, expires_at)
  values (d.id, d.draft_version, d.snapshot_hash, to_jsonb(d), m.user_id, now() + interval '10 minutes') returning id into ap;
  dk := 'wa:'||d.id||':v'||d.draft_version;
  insert into office.outbox_dispatches(approval_id, draft_id, dispatch_key) values (ap, d.id, dk);
  update office.message_drafts set status = 'sending' where id = d.id;
  perform office.audit(m.org_id,'user',m.user_id::text,'approve_and_send','message_draft',d.id::text,null,jsonb_build_object('version',d.draft_version,'hash',d.snapshot_hash,'approval',ap));
  perform office.emit(m.org_id,'message.approved','הודעה אושרה ונכנסה לתור השליחה',null,null,null,'comms_manager',d.client_id);
  return jsonb_build_object('ok', true, 'status', 'sending', 'approval_id', ap, 'dispatch_key', dk);
end $$;
revoke execute on function public.office_approve_and_send(uuid, int, text, text) from anon, public;
grant execute on function public.office_approve_and_send(uuid, int, text, text) to authenticated;
