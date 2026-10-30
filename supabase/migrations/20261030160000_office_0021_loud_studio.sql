-- LOUD Podcast Studio: intake → research → interview kit → internal approval → client review → payment → studio slot → reminders / thanks / materials.
-- Every outbound message is a message_draft that waits for a personal approval in /approvals (scheduled ones surface at their time).

create table if not exists office.studio_settings (
  org_id uuid primary key references office.organizations(id),
  address text default '', parking text default '', prep_guide text default '', session_minutes int not null default 60,
  packages jsonb not null default '[{"key":"intro","title":"חבילת היכרות","price":399,"vat_mode":"included","description":"שעת הקלטה באולפן + 3 ערכות ערוכות"}]',
  updated_at timestamptz not null default now());

create table if not exists office.studio_slots (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references office.organizations(id),
  starts_at timestamptz not null, ends_at timestamptz not null, status text not null default 'open' check (status in ('open','held','booked','blocked')),
  booking_id uuid, note text, created_by uuid, created_at timestamptz not null default now(),
  check (ends_at > starts_at));
create index if not exists studio_slots_time on office.studio_slots(org_id, starts_at);

create table if not exists office.studio_bookings (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references office.organizations(id),
  client_id uuid references office.clients(id), lead_id uuid references office.leads(id), contact_id uuid references office.contacts(id),
  request_id uuid references office.requests(id),
  status text not null default 'intake' check (status in ('intake','questions_review','client_review','changes_requested','awaiting_payment','paid','scheduled','recorded','delivered','cancelled')),
  intake jsonb not null default '{}', kit jsonb, kit_version int not null default 0, kit_ready_at timestamptz,
  package_key text not null default 'intro', package_title text, package_desc text, price numeric(10,2) not null default 399, vat_mode text not null default 'included',
  internal_approved_by uuid, internal_approved_at timestamptz, client_feedback text, client_approved_at timestamptz,
  plan_id uuid, payment_id uuid references office.payments(id), paid_at timestamptz,
  slot_id uuid references office.studio_slots(id), starts_at timestamptz, ends_at timestamptz, meeting_id uuid,
  recorded_at timestamptz, delivered_at timestamptz, deliverables jsonb not null default '[]', public_url text, notes text,
  is_test boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists studio_bookings_org on office.studio_bookings(org_id, status);
alter table office.studio_slots add constraint studio_slots_booking_fk foreign key (booking_id) references office.studio_bookings(id) on delete set null;
alter table office.studio_bookings enable row level security; alter table office.studio_slots enable row level security; alter table office.studio_settings enable row level security;

-- one place to queue a message to the guest (always needs an explicit approval)
create or replace function office.studio_draft(b office.studio_bookings, p_kind text, p_reason text, p_body text, p_when timestamptz default null)
returns uuid language plpgsql security definer set search_path = office, public as $$
declare c office.contacts; v_id uuid;
begin
  select * into c from office.contacts where id = b.contact_id;
  if c.id is null or c.phone_e164 is null then
    insert into office.notifications(org_id, kind, title, link) values (b.org_id, 'approval', 'אין טלפון לאורח/ת — לא נוצרה הודעה: ' || p_reason, '/loud/' || b.id);
    return null; end if;
  -- don't stack duplicates of the same kind that are still waiting
  update office.message_drafts set status = 'cancelled' where business_ref_type = 'studio_booking' and business_ref_id = b.id and kind = p_kind and status in ('draft','pending_approval','needs_review','saved_later');
  insert into office.message_drafts(org_id, client_id, lead_id, conversation_id, contact_id, sender_connection_id, recipient_e164, kind, reason, body,
    business_ref_type, business_ref_id, status, scheduled_for, is_test, snapshot_hash, prepared_by_agent, review_reason)
  values (b.org_id, b.client_id, b.lead_id, (select id from office.conversations where contact_id = c.id order by created_at desc limit 1), c.id,
    (select id from office.connections where org_id = b.org_id and provider in ('whatsapp_cloud','whatsapp_sandbox') and disconnected_at is null order by (provider='whatsapp_cloud') desc limit 1),
    c.phone_e164, p_kind, p_reason, p_body, 'studio_booking', b.id,
    case when p_when > now() then 'draft'::office.msg_status else 'pending_approval'::office.msg_status end, p_when, b.is_test, 'x', 'calendar_manager',
    case when not c.phone_verified then 'המספר הגיע מטופס ההיכרות ואינו מאומת' end) returning id into v_id;
  if p_when is null or p_when <= now() then
    insert into office.notifications(org_id, kind, title, link) values (b.org_id, 'approval', 'LOUD · הודעה ממתינה לאישורך: ' || p_reason, '/approvals?draft=' || v_id);
  end if;
  return v_id;
end $$;

create or replace function office.studio_jlm(p timestamptz, p_fmt text) returns text language sql immutable as $$
  select to_char(p at time zone 'Asia/Jerusalem', p_fmt) $$;

-- ---------- public intake (called by the server route with the worker secret) ----------
create or replace function public.office_worker_studio_intake(p_secret text, p jsonb)
returns jsonb language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; v_client uuid; v_lead uuid; v_contact uuid; v_req uuid; v_b uuid; v_name text; v_biz text; v_phone text;
begin
  v_org := office.worker_org(p_secret);
  v_name := left(trim(coalesce(p->>'name','')), 120); v_biz := left(trim(coalesce(nullif(p->>'business',''), v_name)), 160); v_phone := nullif(p->>'phone_e164','');
  if v_name = '' then raise exception 'name_required'; end if;
  if v_phone is null and coalesce(p->>'email','') = '' then raise exception 'contact_required'; end if;
  -- soft rate limit: same phone/email within 10 minutes returns the existing booking
  select b.id into v_b from office.studio_bookings b join office.contacts c on c.id = b.contact_id
   where b.org_id = v_org and b.created_at > now() - interval '10 minutes' and (c.phone_e164 = v_phone or (p->>'email' <> '' and c.email = p->>'email')) limit 1;
  if v_b is not null then return jsonb_build_object('id', v_b, 'duplicate', true); end if;

  insert into office.clients(org_id, name, industry, department, status, profile, import_source, is_test)
  values (v_org, v_biz, nullif(p->>'industry',''), 'loud', 'onboarding',
    jsonb_build_object('website', nullif(p->>'website',''), 'socials', coalesce(p->'socials','{}'), 'socials_text', p->>'socials_text', 'loud_intake', p, 'source', 'LOUD intake form'),
    'loud_intake', coalesce((p->>'is_test')::boolean, false)) returning id into v_client;
  insert into office.leads(org_id, source, company, contact_name, contact_phone_e164, contact_email, need, goals, requested_services, stage, client_id, dedupe_key, is_test)
  values (v_org, 'loud_intake', v_biz, v_name, v_phone, nullif(p->>'email',''), 'פודקאסט באולפן LOUD', p->>'what_matters', array['podcast'], 'new', v_client,
    'loud:' || coalesce(v_phone, p->>'email') || ':' || to_char(now(),'YYYYMMDDHH24MISS'), coalesce((p->>'is_test')::boolean, false)) returning id into v_lead;
  insert into office.contacts(org_id, client_id, lead_id, name, phone_e164, email, approval_role, whatsapp_opt_in, is_test)
  values (v_org, v_client, v_lead, v_name, v_phone, nullif(p->>'email',''), 'primary', coalesce((p->>'whatsapp_ok')::boolean, true), coalesce((p->>'is_test')::boolean, false)) returning id into v_contact;

  insert into office.requests(org_id, source, mode, text, client_id, scope, status, idempotency_key)
  values (v_org, 'api', 'work', 'LOUD · הכנת קובץ שאלות לראיון: ' || v_name || ' (' || v_biz || ')', v_client, 'client', 'running', 'loud:' || v_client) returning id into v_req;
  insert into office.studio_bookings(org_id, client_id, lead_id, contact_id, request_id, intake, is_test, package_title, package_desc, price)
  select v_org, v_client, v_lead, v_contact, v_req, p, coalesce((p->>'is_test')::boolean, false), pk->>'title', pk->>'description', (pk->>'price')::numeric
    from (select coalesce((select packages->0 from office.studio_settings where org_id = v_org), '{"title":"חבילת היכרות","price":399,"description":"שעת הקלטה באולפן + 3 ערכות ערוכות"}'::jsonb) pk) s
  returning id into v_b;
  perform office.instantiate_workflow(v_org, v_req, 'podcast_prep', v_client, null,
    jsonb_build_object('company', v_biz, 'guest', v_name, 'website', nullif(p->>'website',''), 'socials', coalesce(p->'socials','{}'), 'intake', p, 'booking_id', v_b), 'loud:' || v_b);
  insert into office.notifications(org_id, kind, title, link) values (v_org, 'info', 'LOUD · טופס היכרות חדש: ' || v_name || ' · הסוכנים כבר מכינים שאלות', '/loud/' || v_b);
  perform office.emit(v_org, 'loud.intake', 'טופס היכרות חדש לאולפן LOUD: ' || v_name, null, null, v_req, 'calendar_manager', v_client);
  return jsonb_build_object('id', v_b, 'duplicate', false);
end $$;

create or replace function public.office_worker_studio_set_url(p_secret text, p_id uuid, p_url text)
returns void language plpgsql security definer set search_path = office, public as $$
begin update office.studio_bookings set public_url = p_url where id = p_id and org_id = office.worker_org(p_secret); end $$;

-- ---------- worker: save the interview kit ----------
create or replace function public.office_worker_save_interview(p_secret text, p_task uuid, p_lease uuid, p_kit jsonb)
returns jsonb language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs; b office.studio_bookings; v_n int;
begin
  v_org := office.worker_org(p_secret); t := office.lease_ok(p_task, p_lease);
  select * into b from office.studio_bookings where org_id = t.org_id and (id = nullif(t.inputs->'params'->>'booking_id','')::uuid or request_id = t.request_id) order by created_at desc limit 1;
  if b.id is null then raise exception 'booking_not_found'; end if;
  select coalesce(sum(jsonb_array_length(coalesce(s->'questions','[]'))),0) into v_n from jsonb_array_elements(coalesce(p_kit->'segments','[]')) s;
  update office.studio_bookings set kit = p_kit, kit_version = kit_version + 1, kit_ready_at = now(),
    status = case when status in ('intake','changes_requested') then 'questions_review' else status end, updated_at = now() where id = b.id;
  insert into office.notifications(org_id, kind, title, link) values (t.org_id, 'approval', 'LOUD · קובץ שאלות מוכן לאישורך (' || v_n || ' שאלות)', '/loud/' || b.id);
  return jsonb_build_object('booking_id', b.id, 'questions', v_n);
end $$;

-- ---------- reads for the office ----------
create or replace function public.office_studio_board()
returns jsonb language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships;
begin
  m := office.ctx();
  if m.role not in ('owner','admin','account_manager') then raise exception 'forbidden:loud'; end if;
  return jsonb_build_object(
    'settings', coalesce((select to_jsonb(s) from office.studio_settings s where org_id = m.org_id), jsonb_build_object('packages', '[{"key":"intro","title":"חבילת היכרות","price":399,"vat_mode":"included","description":"שעת הקלטה באולפן + 3 ערכות ערוכות"}]'::jsonb, 'address','', 'parking','', 'prep_guide','', 'session_minutes',60)),
    'bookings', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select b.id, b.status, b.created_at, b.updated_at, b.starts_at, b.price, b.package_title, b.kit_version, b.is_test, b.public_url,
        b.intake->>'name' guest, cl.name business, ct.phone_e164 phone, ct.email,
        coalesce(jsonb_array_length(b.deliverables),0) deliverables, p.status pay_status,
        (select count(*) from office.message_drafts d where d.business_ref_type='studio_booking' and d.business_ref_id=b.id and d.status in ('pending_approval','needs_review')) msgs_waiting,
        (select t.stage from office.task_runs t where t.request_id = b.request_id and t.status in ('running','queued','retrying') order by t.updated_at desc limit 1) working
      from office.studio_bookings b left join office.clients cl on cl.id=b.client_id left join office.contacts ct on ct.id=b.contact_id left join office.payments p on p.id=b.payment_id
      where b.org_id = m.org_id and (b.status <> 'cancelled' or b.updated_at > now() - interval '14 days')) x), '[]'),
    'slots', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'status', s.status, 'note', s.note, 'booking_id', s.booking_id,
        'guest', (select b.intake->>'name' from office.studio_bookings b where b.id = s.booking_id)) order by s.starts_at)
      from office.studio_slots s where s.org_id = m.org_id and s.ends_at > now() - interval '1 day' and s.starts_at < now() + interval '70 days'), '[]'));
end $$;

create or replace function public.office_studio_booking(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships; b office.studio_bookings;
begin
  m := office.ctx();
  select * into b from office.studio_bookings where id = p_id and org_id = m.org_id;
  if b.id is null then raise exception 'not_found'; end if;
  if not office.can_client(m, b.client_id) then raise exception 'forbidden:client'; end if;
  return to_jsonb(b) || jsonb_build_object(
    'client', (select jsonb_build_object('id', c.id, 'name', c.name, 'profile', c.profile) from office.clients c where c.id = b.client_id),
    'contact', (select jsonb_build_object('name', c.name, 'phone', c.phone_e164, 'email', c.email) from office.contacts c where c.id = b.contact_id),
    'payment', (select jsonb_build_object('id', p.id, 'status', p.status, 'amount_gross', p.amount_gross, 'paid_at', p.paid_at, 'link_url', p.link_url) from office.payments p where p.id = b.payment_id),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'reason', d.reason, 'status', d.status, 'scheduled_for', d.scheduled_for, 'body', d.body, 'created_at', d.created_at) order by d.created_at desc)
       from office.message_drafts d where d.business_ref_type = 'studio_booking' and d.business_ref_id = b.id), '[]'),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('title', t.title, 'status', t.status, 'stage', t.stage, 'agent', t.agent_id) order by t.created_at)
       from office.task_runs t where t.request_id = b.request_id), '[]'),
    'open_slots', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at) order by s.starts_at)
       from office.studio_slots s where s.org_id = b.org_id and s.status = 'open' and s.starts_at > now() + interval '12 hours' and s.starts_at < now() + interval '60 days'), '[]'));
end $$;

-- ---------- office actions ----------
create or replace function office.act_studio(m office.memberships, a text, p jsonb)
returns jsonb language plpgsql security definer set search_path = office, public as $$
declare b office.studio_bookings; s office.studio_slots; st office.studio_settings; v_id uuid; v_from timestamptz; v_to timestamptz; i int; w int; n int := 0; v_min int; v_txt text;
begin
  if a not like 'studio_%' then return '"__nohandle"'::jsonb; end if;
  if a in ('studio_save_settings','studio_add_slots','studio_slot_update') then
    if a = 'studio_save_settings' then
      insert into office.studio_settings(org_id) values (m.org_id) on conflict do nothing;
      update office.studio_settings set address = coalesce(p->>'address', address), parking = coalesce(p->>'parking', parking), prep_guide = coalesce(p->>'prep_guide', prep_guide),
        session_minutes = coalesce((p->>'session_minutes')::int, session_minutes), packages = coalesce(p->'packages', packages), updated_at = now() where org_id = m.org_id;
      return jsonb_build_object('ok', true);
    elsif a = 'studio_add_slots' then
      -- p: starts_at (ISO), minutes, count (consecutive sessions), weeks (repeat weekly), gap_minutes
      v_min := greatest(15, least(480, coalesce((p->>'minutes')::int, 60)));
      for w in 0 .. greatest(0, least(12, coalesce((p->>'weeks')::int, 1) - 1)) loop
        for i in 0 .. greatest(0, least(10, coalesce((p->>'count')::int, 1) - 1)) loop
          v_from := (p->>'starts_at')::timestamptz + make_interval(days => 7*w) + make_interval(mins => i * (v_min + coalesce((p->>'gap_minutes')::int, 15)));
          v_to := v_from + make_interval(mins => v_min);
          if not exists(select 1 from office.studio_slots x where x.org_id = m.org_id and x.status <> 'blocked' and tstzrange(x.starts_at, x.ends_at) && tstzrange(v_from, v_to)) then
            insert into office.studio_slots(org_id, starts_at, ends_at, note, created_by) values (m.org_id, v_from, v_to, nullif(p->>'note',''), m.user_id); n := n + 1;
          end if;
        end loop;
      end loop;
      return jsonb_build_object('added', n);
    else
      select * into s from office.studio_slots where id = (p->>'slot_id')::uuid and org_id = m.org_id for update;
      if s.id is null then raise exception 'not_found'; end if;
      if p->>'op' = 'delete' then
        if s.status = 'booked' then raise exception 'slot_booked'; end if;
        delete from office.studio_slots where id = s.id;
      elsif p->>'op' = 'block' then update office.studio_slots set status = 'blocked', note = coalesce(nullif(p->>'note',''), note) where id = s.id and status = 'open';
      elsif p->>'op' = 'open' then update office.studio_slots set status = 'open' where id = s.id and status = 'blocked';
      end if;
      return jsonb_build_object('ok', true);
    end if;
  end if;

  select * into b from office.studio_bookings where id = (p->>'booking_id')::uuid and org_id = m.org_id for update;
  if b.id is null then raise exception 'not_found:booking'; end if;
  if not office.can_client(m, b.client_id) then raise exception 'forbidden:client'; end if;
  select * into st from office.studio_settings where org_id = m.org_id;

  if a = 'studio_save_kit' then
    update office.studio_bookings set kit = p->'kit', kit_version = kit_version + 1, updated_at = now() where id = b.id;
    return jsonb_build_object('ok', true);
  elsif a = 'studio_set_package' then
    if b.payment_id is not null and exists(select 1 from office.payments where id = b.payment_id and status in ('paid','partial')) then raise exception 'already_paid'; end if;
    update office.studio_bookings set package_key = coalesce(p->>'package_key', package_key), package_title = coalesce(p->>'title', package_title), package_desc = coalesce(p->>'description', package_desc),
      price = coalesce((p->>'price')::numeric, price), vat_mode = coalesce(p->>'vat_mode', vat_mode), updated_at = now() where id = b.id;
    -- an unpaid open payment must follow the new price
    if b.payment_id is not null then update office.payments set status = 'cancelled', notes = concat_ws(' · ', notes, 'בוטל — שונתה חבילת LOUD') where id = b.payment_id and status in ('scheduled','link_created');
      update office.studio_bookings set payment_id = null where id = b.id; end if;
    return jsonb_build_object('ok', true);
  elsif a = 'studio_approve_kit' then
    if b.kit is null then raise exception 'no_kit'; end if;
    update office.studio_bookings set status = case when status in ('questions_review','changes_requested','intake') then 'client_review' else status end,
      internal_approved_by = m.user_id, internal_approved_at = now(), public_url = coalesce(nullif(p->>'link',''), public_url), updated_at = now() where id = b.id returning * into b;
    v_id := office.studio_draft(b, 'loud_kit', 'שליחת קובץ השאלות לעיון ואישור',
      'היי ' || coalesce(b.intake->>'name','') || ' 🎙️' || E'\n' || 'כאן אולפן LOUD. הכנו בשבילך את קובץ השאלות לראיון — מבוסס על מה ששיתפת ועל מחקר שעשינו על ' || coalesce((select name from office.clients where id = b.client_id),'העסק') || '.' || E'\n\n' ||
      'אפשר לעבור, להעיר ולאשר כאן:' || E'\n' || coalesce(b.public_url,'') || E'\n\n' || 'אחרי האישור נקבע יחד מועד באולפן. מחכים לך!');
    return jsonb_build_object('ok', true, 'draft_id', v_id);
  elsif a = 'studio_regenerate' then
    update office.studio_bookings set status = 'intake', updated_at = now(), notes = concat_ws(E'\n', notes, nullif(p->>'comment','')) where id = b.id;
    perform office.instantiate_workflow(m.org_id, b.request_id, 'podcast_prep', b.client_id, null,
      jsonb_build_object('company', (select name from office.clients where id = b.client_id), 'guest', b.intake->>'name', 'website', b.intake->>'website', 'socials', coalesce(b.intake->'socials','{}'),
        'intake', b.intake, 'booking_id', b.id, 'revision_comment', coalesce(p->>'comment', b.client_feedback)), 'loud:' || b.id || ':' || to_char(now(),'YYYYMMDDHH24MISS'));
    update office.requests set status = 'running' where id = b.request_id;
    return jsonb_build_object('ok', true);
  elsif a = 'studio_book_slot' then
    select * into s from office.studio_slots where id = (p->>'slot_id')::uuid and org_id = m.org_id for update;
    if s.id is null or s.status <> 'open' then raise exception 'slot_unavailable'; end if;
    if b.slot_id is not null then update office.studio_slots set status = 'open', booking_id = null where id = b.slot_id; end if;
    update office.studio_slots set status = 'booked', booking_id = b.id where id = s.id;
    update office.studio_bookings set slot_id = s.id, starts_at = s.starts_at, ends_at = s.ends_at, status = case when status in ('paid','awaiting_payment','client_review','questions_review') then 'scheduled' else status end, updated_at = now() where id = b.id returning * into b;
    perform office.studio_after_booking(b);
    return jsonb_build_object('ok', true);
  elsif a = 'studio_set_status' then
    if p->>'status' not in ('recorded','delivered','cancelled','paid','scheduled','awaiting_payment','client_review','questions_review') then raise exception 'bad_status'; end if;
    update office.studio_bookings set status = p->>'status', updated_at = now(),
      recorded_at = case when p->>'status' = 'recorded' then now() else recorded_at end, delivered_at = case when p->>'status' = 'delivered' then now() else delivered_at end where id = b.id returning * into b;
    if p->>'status' = 'cancelled' then
      update office.studio_slots set status = 'open', booking_id = null where id = b.slot_id;
      update office.message_drafts set status = 'cancelled' where business_ref_type = 'studio_booking' and business_ref_id = b.id and status in ('draft','pending_approval','needs_review','saved_later');
      update office.meetings set status = 'cancelled' where id = b.meeting_id;
    elsif p->>'status' = 'recorded' then
      update office.meetings set status = 'done' where id = b.meeting_id;
      perform office.studio_draft(b, 'loud_thanks', 'תודה אחרי ההקלטה',
        'היי ' || coalesce(b.intake->>'name','') || ', איזה כיף היה אתמול באולפן! 🎧' || E'\n' || 'תודה על האנרגיה והפתיחות — יצא פרק מעולה.' || E'\n' ||
        'אנחנו כבר בעריכה, ונשלח את החומרים ברגע שיהיו מוכנים.' || E'\n\n' || 'נשמח מאוד אם תכתוב/י לנו כמה מילים על החוויה — זה עוזר לנו המון 🙏' || E'\n' || 'LOUD Podcast Studio',
        ((((now() at time zone 'Asia/Jerusalem')::date + 1) + time '10:30') at time zone 'Asia/Jerusalem'));
    end if;
    return jsonb_build_object('ok', true);
  elsif a = 'studio_add_deliverable' then
    if coalesce(p->>'url','') !~ '^https?://' then raise exception 'url_required'; end if;
    update office.studio_bookings set deliverables = deliverables || jsonb_build_array(jsonb_build_object('id', gen_random_uuid(), 'title', coalesce(nullif(p->>'title',''),'חומר מהפרק'), 'url', p->>'url', 'kind', coalesce(p->>'kind','video'), 'added_at', now())), updated_at = now() where id = b.id;
    return jsonb_build_object('ok', true);
  elsif a = 'studio_remove_deliverable' then
    update office.studio_bookings set deliverables = (select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(deliverables) x where x->>'id' <> p->>'id') where id = b.id;
    return jsonb_build_object('ok', true);
  elsif a = 'studio_send_materials' then
    if jsonb_array_length(b.deliverables) = 0 then raise exception 'no_deliverables'; end if;
    select string_agg('▸ ' || (x->>'title') || E'\n' || (x->>'url'), E'\n') into v_txt from jsonb_array_elements(b.deliverables) x;
    v_id := office.studio_draft(b, 'loud_materials', 'שליחת החומרים הערוכים',
      'היי ' || coalesce(b.intake->>'name','') || ' 🎙️ החומרים מהפרק שלך מוכנים!' || E'\n\n' || v_txt || E'\n\n' || 'הכל מרוכז גם בעמוד האישי שלך: ' || coalesce(b.public_url,'') || E'\n\n' ||
      'טיפ קטן: תעלו את הקטעים בהפרש של 2-3 ימים, ותתייגו אותנו @LOUD — נשתף אצלנו 💛' || E'\n' || 'רוצה להמשיך לסדרת פרקים? רק תגיד/י ונבנה חבילה.');
    update office.studio_bookings set status = 'delivered', delivered_at = now(), updated_at = now() where id = b.id and status in ('recorded','scheduled','paid');
    return jsonb_build_object('ok', true, 'draft_id', v_id);
  elsif a = 'studio_message' then
    v_id := office.studio_draft(b, coalesce(nullif(p->>'kind',''),'loud_custom'), coalesce(nullif(p->>'reason',''),'הודעה לאורח/ת'), p->>'body', nullif(p->>'scheduled_for','')::timestamptz);
    return jsonb_build_object('ok', true, 'draft_id', v_id);
  elsif a = 'studio_notes' then
    update office.studio_bookings set notes = p->>'notes', updated_at = now() where id = b.id; return jsonb_build_object('ok', true);
  end if;
  raise exception 'unknown_action:%', a;
end $$;

-- after a slot is booked: calendar entry + day-before reminder (approval required at its time)
create or replace function office.studio_after_booking(b office.studio_bookings)
returns void language plpgsql security definer set search_path = office, public as $$
declare st office.studio_settings; v_m uuid; v_when timestamptz;
begin
  select * into st from office.studio_settings where org_id = b.org_id;
  if b.meeting_id is not null then update office.meetings set starts_at = b.starts_at, ends_at = b.ends_at, status = 'scheduled', updated_at = now() where id = b.meeting_id;
  else
    insert into office.meetings(org_id, client_id, lead_id, title, starts_at, ends_at, location, status, prep_notes)
    values (b.org_id, b.client_id, b.lead_id, '🎙 LOUD · הקלטה: ' || coalesce(b.intake->>'name',''), b.starts_at, b.ends_at, coalesce(nullif(st.address,''),'אולפן LOUD'), 'scheduled', 'קובץ השאלות: /loud/' || b.id) returning id into v_m;
    update office.studio_bookings set meeting_id = v_m where id = b.id;
  end if;
  v_when := ((((b.starts_at at time zone 'Asia/Jerusalem')::date - 1) + time '10:00') at time zone 'Asia/Jerusalem');
  if v_when < now() then v_when := null; end if;
  perform office.studio_draft(b, 'loud_reminder', 'תזכורת יום לפני ההקלטה',
    'היי ' || coalesce(b.intake->>'name','') || ' 👋 מזכירים שמחר ' || office.studio_jlm(b.starts_at, 'DD/MM') || ' בשעה ' || office.studio_jlm(b.starts_at, 'HH24:MI') || ' נפגשים באולפן LOUD 🎙️' || E'\n' ||
    case when coalesce(st.address,'') <> '' then '📍 ' || st.address || E'\n' else '' end || case when coalesce(st.parking,'') <> '' then '🚗 ' || st.parking || E'\n' else '' end ||
    E'\n' || 'כמה טיפים קטנים: בגדים בצבע אחיד (בלי פסים דקים), להגיע 10 דקות לפני, ולהביא מים 💧' || E'\n' || 'קובץ השאלות כאן: ' || coalesce(b.public_url,'') || E'\n' || 'נתראה!', v_when);
  insert into office.notifications(org_id, kind, title, link) values (b.org_id, 'info', 'LOUD · נקבעה הקלטה: ' || coalesce(b.intake->>'name','') || ' · ' || office.studio_jlm(b.starts_at, 'DD/MM HH24:MI'), '/loud/' || b.id);
end $$;

-- ---------- public (guest) side, via the server route with the worker secret ----------
create or replace function public.office_worker_studio_public(p_secret text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = office, public as $$
declare v_org uuid; b office.studio_bookings; st office.studio_settings;
begin
  v_org := office.worker_org(p_secret);
  select * into b from office.studio_bookings where id = p_id and org_id = v_org;
  if b.id is null then raise exception 'not_found'; end if;
  select * into st from office.studio_settings where org_id = v_org;
  return jsonb_build_object('id', b.id, 'status', b.status, 'name', b.intake->>'name', 'business', (select name from office.clients where id = b.client_id),
    'kit', case when b.status in ('client_review','changes_requested','awaiting_payment','paid','scheduled','recorded','delivered') then b.kit end,
    'feedback', b.client_feedback, 'package_title', b.package_title, 'package_desc', b.package_desc, 'price', b.price, 'vat_mode', b.vat_mode,
    'pay_status', (select status from office.payments where id = b.payment_id), 'payment_id', b.payment_id,
    'starts_at', b.starts_at, 'ends_at', b.ends_at, 'address', st.address, 'parking', st.parking, 'prep_guide', st.prep_guide,
    'deliverables', case when b.status in ('recorded','delivered') then b.deliverables else '[]'::jsonb end,
    'open_slots', case when b.status in ('paid','scheduled') then coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at) order by s.starts_at)
       from office.studio_slots s where s.org_id = v_org and s.status = 'open' and s.starts_at > now() + interval '12 hours' and s.starts_at < now() + interval '60 days'), '[]') else '[]'::jsonb end);
end $$;

create or replace function public.office_worker_studio_client(p_secret text, p_id uuid, p_op text, p jsonb)
returns jsonb language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; b office.studio_bookings; s office.studio_slots; v_plan uuid; v_pay uuid; pay office.payments;
begin
  v_org := office.worker_org(p_secret);
  select * into b from office.studio_bookings where id = p_id and org_id = v_org for update;
  if b.id is null then raise exception 'not_found'; end if;
  if p_op = 'approve' then
    if b.status not in ('client_review','changes_requested') then return jsonb_build_object('ok', true, 'status', b.status); end if;
    update office.studio_bookings set status = 'awaiting_payment', client_approved_at = now(), client_feedback = coalesce(nullif(left(p->>'feedback',3000),''), client_feedback), updated_at = now() where id = b.id;
    insert into office.notifications(org_id, kind, title, link) values (v_org, 'info', 'LOUD · ' || coalesce(b.intake->>'name','') || ' אישר/ה את קובץ השאלות ✓', '/loud/' || b.id);
    return jsonb_build_object('ok', true, 'status', 'awaiting_payment');
  elsif p_op = 'changes' then
    if b.status not in ('client_review','changes_requested') then raise exception 'not_reviewable'; end if;
    if coalesce(trim(p->>'feedback'),'') = '' then raise exception 'feedback_required'; end if;
    update office.studio_bookings set status = 'changes_requested', client_feedback = left(p->>'feedback',3000), updated_at = now() where id = b.id;
    insert into office.notifications(org_id, kind, title, link) values (v_org, 'approval', 'LOUD · ' || coalesce(b.intake->>'name','') || ' ביקש/ה שינויים בשאלות', '/loud/' || b.id);
    return jsonb_build_object('ok', true, 'status', 'changes_requested');
  elsif p_op = 'payment' then
    if b.status not in ('awaiting_payment','paid','scheduled') then raise exception 'approve_first'; end if;
    select * into pay from office.payments where id = b.payment_id;
    if pay.id is not null and pay.status not in ('cancelled') then return jsonb_build_object('ok', true, 'payment_id', pay.id, 'status', pay.status); end if;
    insert into office.billing_plans(org_id, client_id, contact_id, kind, services, title, amount, vat_mode, installments, start_date, status, notes)
    values (v_org, b.client_id, b.contact_id, 'one_time', array['podcast'], 'LOUD · ' || coalesce(b.package_title,'הקלטת פודקאסט'), b.price, b.vat_mode, 1, (now() at time zone 'Asia/Jerusalem')::date, 'active', 'נוצר אוטומטית מהזמנת אולפן LOUD')
    returning id into v_plan;
    insert into office.payments(org_id, client_id, plan_id, seq, period_month, due_date, amount, vat_mode, amount_gross, status, notes)
    values (v_org, b.client_id, v_plan, 1, date_trunc('month', now() at time zone 'Asia/Jerusalem')::date, (now() at time zone 'Asia/Jerusalem')::date, b.price, b.vat_mode,
      case b.vat_mode when 'plus_vat' then round(b.price * 1.18, 2) else b.price end, 'scheduled', 'LOUD · ' || coalesce(b.intake->>'name',''))
    returning id into v_pay;
    update office.studio_bookings set plan_id = v_plan, payment_id = v_pay, updated_at = now() where id = b.id;
    return jsonb_build_object('ok', true, 'payment_id', v_pay, 'status', 'scheduled');
  elsif p_op = 'slot' then
    if b.status not in ('paid','scheduled') then raise exception 'pay_first'; end if;
    select * into s from office.studio_slots where id = (p->>'slot_id')::uuid and org_id = v_org for update;
    if s.id is null or s.status <> 'open' or s.starts_at < now() + interval '12 hours' then raise exception 'slot_unavailable'; end if;
    if b.slot_id is not null then update office.studio_slots set status = 'open', booking_id = null where id = b.slot_id and status = 'booked'; end if;
    update office.studio_slots set status = 'booked', booking_id = b.id where id = s.id;
    update office.studio_bookings set slot_id = s.id, starts_at = s.starts_at, ends_at = s.ends_at, status = 'scheduled', updated_at = now() where id = b.id returning * into b;
    perform office.studio_after_booking(b);
    return jsonb_build_object('ok', true, 'starts_at', s.starts_at);
  end if;
  raise exception 'unknown_op';
end $$;

-- payment → booking
create or replace function office.studio_on_payment() returns trigger language plpgsql security definer set search_path = office, public as $$
declare b office.studio_bookings;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    update office.studio_bookings set status = case when status = 'awaiting_payment' then 'paid' else status end, paid_at = now(), updated_at = now()
     where payment_id = new.id returning * into b;
    if b.id is not null then
      insert into office.notifications(org_id, kind, title, link) values (b.org_id, 'info', 'LOUD · התקבל תשלום מ-' || coalesce(b.intake->>'name','') || ' — ממתין לבחירת מועד', '/loud/' || b.id);
    end if;
  end if;
  return new;
end $$;
create or replace trigger studio_on_payment after update of status on office.payments for each row execute function office.studio_on_payment();

-- workflow
insert into office.workflow_templates(key, name, description, steps) values ('podcast_prep', 'LOUD · הכנת ראיון פודקאסט', 'מחקר על האורח/ת והעסק ובניית קובץ שאלות לשעת ראיון', $j$[
 {"key":"crawl","kind":"tool:crawl_site","agent":"knowledge_manager","title":"סריקת האתר של האורח/ת"},
 {"key":"social","kind":"tool:social_scan","agent":"social_manager","title":"סושיאל ודוגמאות תוכן","depends":["crawl"]},
 {"key":"web","kind":"tool:web_research","agent":"market_researcher","title":"מחקר רשת: סיפור, תקשורת ומוניטין","depends":["crawl"],"caps":["generate_text"]},
 {"key":"questions","kind":"ai","agent":"scriptwriter","title":"בניית קובץ שאלות לשעת ראיון","depends":["crawl","social","web"],"caps":["generate_text"],"output_kind":"interview_kit","max_tokens":9000,
  "instruction":"את/ה תחקירן/ית ומפיק/ה של אולפן הפודקאסטים LOUD. בנה/י קובץ שאלות לראיון של שעה עם האורח/ת (params.guest) על העסק (params.company). התבסס/י על טופס ההיכרות (params.intake: מה חשוב לו בפודקאסט, האם עשה בעבר, 3 נקודות מפתח שהוא רוצה להעביר) ועל המחקר בשלבים הקודמים. מבנה: פתיח חם, 5-6 מקטעים עם זמן בדקות (סה״כ כ-55 דקות), בכל מקטע 4-6 שאלות פתוחות שמזמינות סיפור, עם שאלות המשך ו-note קצר למראיין (מה לחפש בתשובה / עובדה מהמחקר). חובה שכל אחת מ-3 נקודות המפתח תקבל מקטע או שאלות ייעודיות. הוסף/י סגירה עם קריאה לפעולה, 6-8 רעיונות לקטעים קצרים (clips) לרשתות, ונושאים להימנע מהם. כתוב/י בעברית טבעית בגוף שני, בגובה העיניים. אם params.revision_comment קיים — תקן/י לפיו. אל תמציא/י עובדות; מה שלא אומת סמן/י כהשערה ב-note."},
 {"key":"save","kind":"tool:save_interview","agent":"calendar_manager","title":"שמירת קובץ השאלות לאישורך","depends":["questions"]}
]$j$::jsonb)
on conflict (key) do update set name = excluded.name, description = excluded.description, steps = excluded.steps;

insert into office.action_permissions(action, roles, description) values
 ('studio_save_settings', '{owner,admin}', 'LOUD · הגדרות אולפן'),
 ('studio_add_slots', '{owner,admin,account_manager}', 'LOUD · הוספת זמינות'),
 ('studio_slot_update', '{owner,admin,account_manager}', 'LOUD · עדכון משבצת'),
 ('studio_save_kit', '{owner,admin,account_manager}', 'LOUD · עריכת קובץ שאלות'),
 ('studio_set_package', '{owner,admin}', 'LOUD · חבילה ומחיר'),
 ('studio_approve_kit', '{owner,admin}', 'LOUD · אישור קובץ שאלות ושליחה ללקוח'),
 ('studio_regenerate', '{owner,admin,account_manager}', 'LOUD · בנייה מחדש של השאלות'),
 ('studio_book_slot', '{owner,admin,account_manager}', 'LOUD · קביעת מועד'),
 ('studio_set_status', '{owner,admin,account_manager}', 'LOUD · עדכון סטטוס'),
 ('studio_add_deliverable', '{owner,admin,account_manager}', 'LOUD · הוספת חומר'),
 ('studio_remove_deliverable', '{owner,admin,account_manager}', 'LOUD · הסרת חומר'),
 ('studio_send_materials', '{owner,admin,account_manager}', 'LOUD · שליחת חומרים'),
 ('studio_message', '{owner,admin,account_manager}', 'LOUD · הודעה לאורח'),
 ('studio_notes', '{owner,admin,account_manager}', 'LOUD · הערות')
on conflict (action) do update set roles = excluded.roles, description = excluded.description;

create or replace function public.office_action(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = office, public as $function$
declare m office.memberships; r jsonb; p jsonb := coalesce(p_payload,'{}'::jsonb);
begin
  m := office.ctx();
  perform office.require(m, p_action);
  r := office.act_crm(m, p_action, p);
  if r = '"__nohandle"'::jsonb then r := office.act_work(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_admin(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_billing(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_proposals(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_research(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_content(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_studio(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then raise exception 'unknown_action:%', p_action; end if;
  return r;
end $function$;

revoke all on function public.office_worker_studio_intake(text, jsonb), public.office_worker_studio_set_url(text, uuid, text), public.office_worker_save_interview(text, uuid, uuid, jsonb),
  public.office_worker_studio_public(text, uuid), public.office_worker_studio_client(text, uuid, text, jsonb) from public;
grant execute on function public.office_worker_studio_intake(text, jsonb), public.office_worker_studio_set_url(text, uuid, text), public.office_worker_save_interview(text, uuid, uuid, jsonb),
  public.office_worker_studio_public(text, uuid), public.office_worker_studio_client(text, uuid, text, jsonb) to anon, authenticated, service_role;
revoke all on function public.office_studio_board(), public.office_studio_booking(uuid) from public, anon;
grant execute on function public.office_studio_board(), public.office_studio_booking(uuid) to authenticated;
