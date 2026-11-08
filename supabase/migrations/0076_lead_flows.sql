-- 0076 lead_flows — WhatsApp warm-up for inbound form leads (Tal, 08.11.2026).
-- Authorized explicitly by the owner on 08.11.2026 09:04: "אני מאשר שתסריט וואטסאפ שאישרתי פעם אחת במערכת יחליף את האישור שלי לכל הודעה, רק בשיחות חימום עם לידים מהטופס של פיקסל ו-LOUD."
-- Built OFF. A flow sends only when: enabled by the owner AND its exact scripts (hash) were approved by the owner.
-- Every send still goes through message_drafts → message_approvals → outbox_dispatches; the approval row is
-- backed by the owner's standing approval of these exact scripts (approved_by = owner, snapshot = text sent).
create table if not exists office.lead_flows (
  org_id uuid not null references office.organizations(id),
  brand text not null check (brand in ('pixel','loud')),
  enabled boolean not null default false,
  template_name text not null default '',
  template_lang text not null default 'he',
  opener text not null default '',
  questions jsonb not null default '[]'::jsonb,
  closing text not null default '',
  handoff text not null default '',
  approved_by uuid, approved_at timestamptz, approved_hash text,
  updated_at timestamptz not null default now(),
  primary key (org_id, brand)
);
alter table office.lead_flows enable row level security;

create table if not exists office.lead_flow_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references office.organizations(id),
  lead_id uuid not null unique references office.leads(id),
  brand text not null,
  contact_id uuid not null references office.contacts(id),
  step int not null default 0,              -- number of questions already sent
  status text not null default 'active' check (status in ('active','done','handoff','opted_out','failed')),
  answers jsonb not null default '[]'::jsonb,
  flow_hash text not null,
  mailed_at timestamptz,
  last_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table office.lead_flow_sessions enable row level security;
create index if not exists lead_flow_sessions_contact on office.lead_flow_sessions(contact_id) where status = 'active';

create or replace function office.lead_flow_hash(f office.lead_flows) returns text language sql immutable as $$
  select md5(concat_ws(E'\x1f', f.template_name, f.template_lang, f.opener, f.questions::text, f.closing, f.handoff)) $$;

-- The sender connection a flow may use: verified WhatsApp Cloud with send capability (sandbox only to test numbers).
create or replace function office.lead_flow_sender(p_org uuid) returns office.connections language sql stable security definer set search_path to 'office','public' as $$
  select sc.* from office.connections sc
  where sc.org_id = p_org and sc.provider in ('whatsapp_cloud','whatsapp_sandbox') and sc.disconnected_at is null
    and sc.status in ('access_verified','action_tested')
    and exists(select 1 from office.connection_capabilities cc where cc.connection_id = sc.id and cc.capability = 'send_message' and cc.implemented and cc.status in ('access_verified','action_tested'))
  order by (sc.provider = 'whatsapp_cloud') desc limit 1 $$;

-- One outbound message of an approved flow: draft + approval (backed by the flow approval) + dispatch.
create or replace function office.lead_flow_send(s office.lead_flow_sessions, f office.lead_flows, p_body text, p_template boolean) returns uuid
language plpgsql security definer set search_path to 'office','public' as $$
declare c office.contacts; sc office.connections; d office.message_drafts; ap uuid; v_tests jsonb;
begin
  if s.brand not in ('pixel','loud') then return null; end if;
  if not exists(select 1 from office.leads where id = s.lead_id and source like 'hook:%') then return null; end if;
  select * into c from office.contacts where id = s.contact_id;
  if c.opted_out_at is not null then return null; end if;
  sc := office.lead_flow_sender(s.org_id);
  if sc.id is null then return null; end if;
  if sc.provider = 'whatsapp_sandbox' then
    select settings->'test_numbers' into v_tests from office.organizations where id = s.org_id;
    if not (coalesce(v_tests,'[]'::jsonb) ? c.phone_e164) then return null; end if;
  end if;
  insert into office.message_drafts(org_id, lead_id, conversation_id, contact_id, sender_connection_id, recipient_e164, kind, reason, body,
    template_name, template_params, business_ref_type, business_ref_id, status, is_test, snapshot_hash, prepared_by_agent)
  values (s.org_id, s.lead_id, (select id from office.conversations where contact_id = c.id order by created_at desc limit 1), c.id, sc.id, c.phone_e164,
    'lead_flow', 'חימום ליד אוטומטי (' || s.brand || ') — לפי תסריט שאושר מראש', p_body,
    case when p_template then nullif(f.template_name,'') end,
    case when p_template then jsonb_build_object('params', jsonb_build_array(office.first_name(c.name))) end,
    'lead_flow', s.id, 'pending_approval', coalesce(c.is_test,false), 'x', 'lead_flow')
  returning * into d;
  insert into office.message_approvals(draft_id, draft_version, snapshot_hash, snapshot, approved_by, expires_at)
  values (d.id, d.draft_version, d.snapshot_hash, to_jsonb(d) || jsonb_build_object('standing_flow', s.brand, 'flow_hash', f.approved_hash), f.approved_by, now() + interval '10 minutes')
  returning id into ap;
  insert into office.outbox_dispatches(approval_id, draft_id, dispatch_key) values (ap, d.id, 'wa:' || d.id || ':v' || d.draft_version);
  update office.message_drafts set status = 'sending' where id = d.id;
  update office.lead_flow_sessions set last_out_at = now(), updated_at = now() where id = s.id;
  perform office.audit(s.org_id, 'system', 'lead_flow', 'standing_send', 'message_draft', d.id::text, null, jsonb_build_object('brand', s.brand, 'flow_hash', f.approved_hash, 'approved_by', f.approved_by));
  return d.id;
end $$;

-- Start: called right after a new form lead is created. Silent no-op unless the flow is enabled + approved + a sender exists.
create or replace function office.lead_flow_start(p_org uuid, p_lead uuid, p_brand text) returns jsonb
language plpgsql security definer set search_path to 'office','public' as $$
declare f office.lead_flows; l office.leads; c office.contacts; s office.lead_flow_sessions; v_d uuid;
begin
  if p_brand not in ('pixel','loud') then return jsonb_build_object('started', false, 'why', 'brand'); end if;
  select * into f from office.lead_flows where org_id = p_org and brand = p_brand;
  if f.org_id is null or not f.enabled then return jsonb_build_object('started', false, 'why', 'off'); end if;
  if f.approved_hash is null or f.approved_hash <> office.lead_flow_hash(f) or nullif(f.template_name,'') is null then return jsonb_build_object('started', false, 'why', 'not_approved'); end if;
  if not exists(select 1 from office.memberships where org_id = p_org and user_id = f.approved_by and role = 'owner') then return jsonb_build_object('started', false, 'why', 'approver_not_owner'); end if;
  if (office.lead_flow_sender(p_org)).id is null then return jsonb_build_object('started', false, 'why', 'no_sender'); end if;
  select * into l from office.leads where id = p_lead and org_id = p_org and source like 'hook:%';
  if l.id is null or l.contact_phone_e164 is null then return jsonb_build_object('started', false, 'why', 'no_phone'); end if;
  if exists(select 1 from office.lead_flow_sessions where lead_id = l.id) then return jsonb_build_object('started', false, 'why', 'exists'); end if;
  -- never re-contact someone who opted out, or who is already mid-flow from another lead
  if exists(select 1 from office.contacts where org_id = p_org and phone_e164 = l.contact_phone_e164 and opted_out_at is not null) then return jsonb_build_object('started', false, 'why', 'opted_out'); end if;
  if exists(select 1 from office.lead_flow_sessions fs join office.contacts cc on cc.id = fs.contact_id where fs.org_id = p_org and cc.phone_e164 = l.contact_phone_e164 and fs.status = 'active') then return jsonb_build_object('started', false, 'why', 'active_elsewhere'); end if;
  select * into c from office.contacts where org_id = p_org and lead_id = l.id and phone_e164 = l.contact_phone_e164 and archived_at is null limit 1;
  if c.id is null then
    insert into office.contacts(org_id, lead_id, name, phone_e164, email) values (p_org, l.id, coalesce(l.contact_name, l.company, 'ליד'), l.contact_phone_e164, l.contact_email) returning * into c;
  end if;
  insert into office.lead_flow_sessions(org_id, lead_id, brand, contact_id, flow_hash) values (p_org, l.id, p_brand, c.id, f.approved_hash) returning * into s;
  v_d := office.lead_flow_send(s, f, replace(f.opener, '{{1}}', office.first_name(c.name)), true);
  if v_d is null then update office.lead_flow_sessions set status = 'failed', updated_at = now() where id = s.id; return jsonb_build_object('started', false, 'why', 'send_blocked'); end if;
  return jsonb_build_object('started', true, 'session', s.id);
end $$;

-- A reply from a contact in an active flow. Returns true when handled (so the generic agent draft is skipped).
create or replace function office.lead_flow_on_reply(p_contact uuid, p_text text) returns boolean
language plpgsql security definer set search_path to 'office','public' as $$
declare s office.lead_flow_sessions; f office.lead_flows; c office.contacts; q jsonb; n int; v_txt text := coalesce(p_text,'');
begin
  select * into s from office.lead_flow_sessions where contact_id = p_contact and status = 'active' order by created_at desc limit 1 for update;
  if s.id is null then return false; end if;
  select * into f from office.lead_flows where org_id = s.org_id and brand = s.brand;
  select * into c from office.contacts where id = p_contact;
  -- record the answer (step 0 = reply to the opener)
  q := coalesce(f.questions->(s.step - 1), to_jsonb('פתיחה'::text));
  update office.lead_flow_sessions set answers = answers || jsonb_build_array(jsonb_build_object('q', q, 'a', left(v_txt, 1000), 'at', now())), updated_at = now() where id = s.id returning * into s;
  if c.opted_out_at is not null or lower(v_txt) ~ '^\s*(stop|הסר|הפסק|לא מעוניינ)' then
    update office.contacts set opted_out_at = coalesce(opted_out_at, now()) where id = p_contact;
    update office.lead_flow_sessions set status = 'opted_out', updated_at = now() where id = s.id;
    return true;
  end if;
  -- flow scripts changed or switched off since this session started → stop and hand to Tal
  if not f.enabled or f.approved_hash is distinct from s.flow_hash or f.approved_hash <> office.lead_flow_hash(f) then
    update office.lead_flow_sessions set status = 'handoff', updated_at = now() where id = s.id; return true;
  end if;
  -- a question or a request for a person → stop, send the approved handoff line, Tal takes over
  if v_txt ~ '\?' or v_txt ~ '(נציג|בן אדם|לדבר עם|תתקשר|תחזר|מחיר|כמה עולה|עלות)' then
    if nullif(f.handoff,'') is not null then perform office.lead_flow_send(s, f, f.handoff, false); end if;
    update office.lead_flow_sessions set status = 'handoff', updated_at = now() where id = s.id; return true;
  end if;
  n := jsonb_array_length(f.questions);
  if s.step < n then
    perform office.lead_flow_send(s, f, f.questions->>s.step, false);
    update office.lead_flow_sessions set step = step + 1, updated_at = now() where id = s.id;
  else
    if nullif(f.closing,'') is not null then perform office.lead_flow_send(s, f, f.closing, false); end if;
    update office.lead_flow_sessions set status = 'done', updated_at = now() where id = s.id;
  end if;
  return true;
end $$;

-- Owner UI
create or replace function public.office_lead_flows_get() returns jsonb language plpgsql stable security definer set search_path to 'office','public' as $$
declare m office.memberships;
begin
  m := office.ctx(); if m.role <> 'owner' then raise exception 'forbidden:lead_flows'; end if;
  return jsonb_build_object(
    'flows', coalesce((select jsonb_agg(to_jsonb(f) || jsonb_build_object('hash', office.lead_flow_hash(f), 'approved', f.approved_hash = office.lead_flow_hash(f)) order by f.brand) from office.lead_flows f where f.org_id = m.org_id), '[]'),
    'sender', (select jsonb_build_object('provider', s.provider, 'label', s.label) from office.lead_flow_sender(m.org_id) s where s.id is not null),
    'sessions', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select fs.id, fs.brand, fs.status, fs.step, fs.created_at, fs.answers, l.id lead_id, coalesce(l.contact_name, l.company) name
      from office.lead_flow_sessions fs join office.leads l on l.id = fs.lead_id where fs.org_id = m.org_id order by fs.created_at desc limit 30) x), '[]'));
end $$;

create or replace function public.office_lead_flow_save(p_brand text, p jsonb) returns jsonb language plpgsql security definer set search_path to 'office','public' as $$
declare m office.memberships; f office.lead_flows; qs jsonb;
begin
  m := office.ctx(); if m.role <> 'owner' then raise exception 'forbidden:lead_flows'; end if;
  if p_brand not in ('pixel','loud') then raise exception 'bad_brand'; end if;
  select coalesce(jsonb_agg(to_jsonb(left(trim(x),600))), '[]') into qs from jsonb_array_elements_text(coalesce(p->'questions','[]')) x where trim(x) <> '';
  if jsonb_array_length(qs) > 6 then raise exception 'too_many_questions'; end if;
  insert into office.lead_flows(org_id, brand) values (m.org_id, p_brand) on conflict do nothing;
  update office.lead_flows set template_name = left(trim(coalesce(p->>'template_name','')),120), template_lang = coalesce(nullif(trim(p->>'template_lang'),''),'he'),
    opener = left(coalesce(p->>'opener',''),1000), questions = qs, closing = left(coalesce(p->>'closing',''),600), handoff = left(coalesce(p->>'handoff',''),600), updated_at = now()
  where org_id = m.org_id and brand = p_brand returning * into f;
  -- any text change voids the approval and switches the flow off
  if f.approved_hash is distinct from office.lead_flow_hash(f) then update office.lead_flows set enabled = false where org_id = m.org_id and brand = p_brand; end if;
  perform office.audit(m.org_id,'user',m.user_id::text,'lead_flow_save','lead_flow',p_brand,null,jsonb_build_object('hash', office.lead_flow_hash(f)));
  return jsonb_build_object('ok', true, 'hash', office.lead_flow_hash(f));
end $$;

create or replace function public.office_lead_flow_approve(p_brand text, p_hash text) returns jsonb language plpgsql security definer set search_path to 'office','public' as $$
declare m office.memberships; f office.lead_flows;
begin
  m := office.ctx(); if m.role <> 'owner' then raise exception 'only_owner_can_approve_messages' using errcode = '42501'; end if;
  select * into f from office.lead_flows where org_id = m.org_id and brand = p_brand for update;
  if f.org_id is null then raise exception 'not_found'; end if;
  if office.lead_flow_hash(f) <> p_hash then raise exception 'snapshot_changed_reload'; end if;
  if nullif(f.template_name,'') is null or nullif(trim(f.opener),'') is null or jsonb_array_length(f.questions) = 0 then raise exception 'flow_incomplete'; end if;
  update office.lead_flows set approved_by = m.user_id, approved_at = now(), approved_hash = p_hash where org_id = m.org_id and brand = p_brand;
  perform office.audit(m.org_id,'user',m.user_id::text,'lead_flow_approve','lead_flow',p_brand,null,jsonb_build_object('hash', p_hash, 'scripts', to_jsonb(f)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.office_lead_flow_toggle(p_brand text, p_enabled boolean) returns jsonb language plpgsql security definer set search_path to 'office','public' as $$
declare m office.memberships; f office.lead_flows;
begin
  m := office.ctx(); if m.role <> 'owner' then raise exception 'forbidden:lead_flows'; end if;
  select * into f from office.lead_flows where org_id = m.org_id and brand = p_brand for update;
  if f.org_id is null then raise exception 'not_found'; end if;
  if p_enabled and (f.approved_hash is null or f.approved_hash <> office.lead_flow_hash(f)) then raise exception 'flow_not_approved'; end if;
  update office.lead_flows set enabled = p_enabled, updated_at = now() where org_id = m.org_id and brand = p_brand;
  perform office.audit(m.org_id,'user',m.user_id::text, case when p_enabled then 'lead_flow_on' else 'lead_flow_off' end,'lead_flow',p_brand,null,null);
  return jsonb_build_object('ok', true, 'enabled', p_enabled, 'sender', (office.lead_flow_sender(m.org_id)).provider);
end $$;

-- Worker: finished / handed-off sessions that still need an email to Tal
create or replace function public.office_worker_lead_flow_mail(p_secret text) returns jsonb language plpgsql security definer set search_path to 'office','public' as $$
declare v_org uuid; res jsonb;
begin
  v_org := office.worker_org(p_secret);
  with x as (
    update office.lead_flow_sessions fs set mailed_at = now()
    where fs.id in (select id from office.lead_flow_sessions where org_id = v_org and status in ('done','handoff') and mailed_at is null limit 10)
    returning fs.*)
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'brand', x.brand, 'status', x.status, 'answers', x.answers, 'lead_id', x.lead_id,
    'name', coalesce(l.contact_name, l.company), 'phone', l.contact_phone_e164)), '[]') into res
  from x join office.leads l on l.id = x.lead_id;
  -- answers also land on the lead card
  update office.leads l set need = concat_ws(E'\n\n', l.need, '— תשובות בוואטסאפ —' || E'\n' || (select string_agg((a->>'q') || ': ' || (a->>'a'), E'\n') from jsonb_array_elements(fs.answers) a)), updated_at = now()
  from office.lead_flow_sessions fs where fs.lead_id = l.id and fs.id in (select (e->>'id')::uuid from jsonb_array_elements(res) e);
  insert into office.notifications(org_id, kind, title, link)
  select v_org, 'approval', case when (e->>'status') = 'done' then '🔥 ליד ענה על כל השאלות: ' else '🙋 ליד מבקש שיחה איתך: ' end || coalesce(e->>'name',''), '/leads/' || (e->>'lead_id')
  from jsonb_array_elements(res) e;
  return res;
end $$;

-- Hooks (applied as patches): office_worker_lead_hook calls office.lead_flow_start after a new lead (errors → notification, lead still saved);
-- office_provider_event routes inbound replies of an active session to office.lead_flow_on_reply instead of the generic agent draft.
