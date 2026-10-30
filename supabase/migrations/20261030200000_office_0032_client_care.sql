-- Client-care automations: every outbound message is a draft that needs Tal's approval.
create table if not exists office.care_rules (
  org_id uuid not null, key text not null, enabled boolean not null default true, params jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), primary key (org_id, key));
create table if not exists office.care_log (
  id uuid primary key default gen_random_uuid(), org_id uuid not null, rule text not null, ref_type text not null, ref_id uuid not null,
  period text not null default '', client_id uuid, lead_id uuid, draft_id uuid, note text, created_at timestamptz not null default now(),
  unique (org_id, rule, ref_type, ref_id, period));
alter table office.care_rules enable row level security; alter table office.care_log enable row level security;

create or replace function office.care_on(p_org uuid, p_key text) returns boolean language sql stable security definer set search_path = office, public as $$
  select coalesce((select enabled from office.care_rules where org_id = p_org and key = p_key), true) $$;

create or replace function office.care_contact(p_client uuid, p_lead uuid) returns office.contacts language sql stable security definer set search_path = office, public as $$
  select c.* from office.contacts c
  where c.archived_at is null and c.opted_out_at is null and c.phone_e164 is not null
    and ((p_client is not null and c.client_id = p_client) or (p_lead is not null and c.lead_id = p_lead))
  order by (c.approval_role is not null) desc, c.phone_verified desc, c.created_at limit 1 $$;

create or replace function office.first_name(n text) returns text language sql immutable as $$ select coalesce(nullif(split_part(trim(coalesce(n,'')), ' ', 1), ''), 'שלום') $$;

-- returns draft id (or null if nothing created / already done)
create or replace function office.care_draft(p_org uuid, p_client uuid, p_lead uuid, p_rule text, p_kind text, p_reason text, p_body text,
  p_ref_type text, p_ref_id uuid, p_period text default '') returns uuid language plpgsql security definer set search_path = office, public as $$
declare c office.contacts; v_log uuid; v_id uuid; v_link text;
begin
  insert into office.care_log(org_id, rule, ref_type, ref_id, period, client_id, lead_id)
  values (p_org, p_rule, p_ref_type, p_ref_id, coalesce(p_period,''), p_client, p_lead)
  on conflict do nothing returning id into v_log;
  if v_log is null then return null; end if;
  v_link := case when p_client is not null then '/clients/' || p_client when p_lead is not null then '/leads/' || p_lead else '/approvals' end;
  c := office.care_contact(p_client, p_lead);
  if c.id is null then
    update office.care_log set note = 'no_phone' where id = v_log;
    insert into office.notifications(org_id, kind, title, link) values (p_org, 'info', 'שירות · אין איש קשר עם טלפון — ' || p_reason, v_link);
    return null;
  end if;
  insert into office.message_drafts(org_id, client_id, lead_id, conversation_id, contact_id, sender_connection_id, recipient_e164, kind, reason, body,
    business_ref_type, business_ref_id, status, is_test, snapshot_hash, prepared_by_agent, review_reason)
  values (p_org, p_client, p_lead, (select id from office.conversations where contact_id = c.id order by created_at desc limit 1), c.id,
    (select id from office.connections where org_id = p_org and provider in ('whatsapp_cloud','whatsapp_sandbox') and disconnected_at is null order by (provider='whatsapp_cloud') desc limit 1),
    c.phone_e164, p_kind, p_reason, replace(p_body, '{name}', office.first_name(c.name)), p_ref_type, p_ref_id,
    'pending_approval', coalesce(c.is_test, false), 'x', 'account_manager',
    case when not c.phone_verified then 'המספר לא אומת' end) returning id into v_id;
  update office.care_log set draft_id = v_id where id = v_log;
  insert into office.notifications(org_id, kind, title, link) values (p_org, 'approval', 'שירות · ממתין לאישורך: ' || p_reason, '/approvals?draft=' || v_id);
  return v_id;
end $$;

create or replace function office.care_alert(p_org uuid, p_rule text, p_ref_type text, p_ref_id uuid, p_period text, p_title text, p_link text) returns boolean
language plpgsql security definer set search_path = office, public as $$
declare v uuid; begin
  insert into office.care_log(org_id, rule, ref_type, ref_id, period) values (p_org, p_rule, p_ref_type, p_ref_id, p_period) on conflict do nothing returning id into v;
  if v is null then return false; end if;
  insert into office.notifications(org_id, kind, title, link) values (p_org, 'info', p_title, p_link);
  return true; end $$;

create or replace function public.office_worker_care_tick(p_secret text) returns jsonb language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; r record; n jsonb := '{}'::jsonb; k int; today date := (now() at time zone 'Asia/Jerusalem')::date;
  sig text := E'\n\nטל, Pixel Digital';
  v_next text; v_body text;
begin
  v_org := office.worker_org(p_secret);

  -- 1. instant acknowledgment for a new lead
  k := 0; if office.care_on(v_org, 'lead_ack') then
  for r in select l.* from office.leads l where l.org_id = v_org and l.archived_at is null and not l.is_test and l.client_id is null
      and l.created_at > now() - interval '3 hours' and l.stage = 'new' loop
    if office.care_draft(v_org, null, r.id, 'lead_ack', 'care_lead_ack', 'מענה ראשון לליד ' || coalesce(r.company, r.contact_name, ''),
      'היי {name}, תודה שפנית ל-Pixel Digital! 🙌' || E'\n' || 'קיבלנו את הפרטים' || coalesce(' לגבי ' || nullif(r.need,''), '') || ', ונחזור אליך תוך שעה לשיחת היכרות קצרה.' || sig,
      'lead', r.id) is not null then k := k + 1; end if;
  end loop; end if; n := n || jsonb_build_object('lead_ack', k);

  -- 2. lead without handling for 24h → internal alert
  k := 0; if office.care_on(v_org, 'lead_sla') then
  for r in select l.* from office.leads l where l.org_id = v_org and l.archived_at is null and not l.is_test and l.client_id is null
      and l.stage = 'new' and l.created_at < now() - interval '24 hours' and l.created_at > now() - interval '14 days' loop
    if office.care_alert(v_org, 'lead_sla', 'lead', r.id, '', '⏰ ליד מחכה מעל 24 שעות: ' || coalesce(r.company, r.contact_name, 'ליד'), '/leads/' || r.id) then k := k + 1; end if;
  end loop; end if; n := n || jsonb_build_object('lead_sla', k);

  -- 3. proposal follow-up after 3 and 7 days
  k := 0; if office.care_on(v_org, 'proposal_followup') then
  for r in select p.*, (today - (p.updated_at at time zone 'Asia/Jerusalem')::date) age from office.proposals p
      where p.org_id = v_org and p.archived_at is null and p.status in ('sent','negotiation') and p.updated_at < now() - interval '3 days' loop
    if r.age >= 3 and r.age < 7 then
      if office.care_draft(v_org, r.client_id, r.lead_id, 'proposal_followup', 'care_proposal_fu', 'פולואפ להצעה: ' || r.title,
        'היי {name}, רציתי לוודא שההצעה "' || r.title || '" הגיעה ושהכל ברור 😊' || E'\n' || 'אם נוח לך, אשמח לקפוץ ל-10 דקות שיחה ולענות על כל שאלה.' || sig,
        'proposal', r.id, 'd3') is not null then k := k + 1; end if;
    elsif r.age >= 7 and r.age < 21 then
      if office.care_draft(v_org, r.client_id, r.lead_id, 'proposal_followup', 'care_proposal_fu', 'פולואפ שני להצעה: ' || r.title,
        'היי {name}, חוזר אליך לגבי ההצעה "' || r.title || '". אם משהו לא מתאים — בתקציב, בהיקף או בלוחות הזמנים — נשמח להתאים. מה הכי נוח לך?' || sig,
        'proposal', r.id, 'd7') is not null then k := k + 1; end if;
    end if;
  end loop; end if; n := n || jsonb_build_object('proposal_followup', k);

  -- 4. payment reminders (3 days before / 3 days late)
  k := 0; if office.care_on(v_org, 'payment_reminder') then
  for r in select p.*, c.name client_name from office.payments p join office.clients c on c.id = p.client_id
      where p.org_id = v_org and c.archived_at is null and not coalesce(c.is_test,false) and p.status in ('scheduled','link_created','partial')
        and p.due_date in (today + 3, today - 3) loop
    if office.care_draft(v_org, r.client_id, null, 'payment_reminder', 'care_payment', case when r.due_date > today then 'תזכורת תשלום קרוב · ' else 'תשלום באיחור · ' end || r.client_name,
      case when r.due_date > today
        then 'היי {name}, תזכורת ידידותית: ב-' || to_char(r.due_date, 'DD.MM') || ' מועד התשלום הבא (' || to_char(coalesce(r.amount_gross, r.amount), 'FM999,999') || ' ₪).'
        else 'היי {name}, נראה שהתשלום מ-' || to_char(r.due_date, 'DD.MM') || ' (' || to_char(coalesce(r.amount_gross, r.amount), 'FM999,999') || ' ₪) עוד לא הוסדר. אם כבר שילמת — אפשר להתעלם 🙏' end
        || coalesce(E'\n' || 'לתשלום מאובטח: ' || r.link_url, '') || sig,
      'payment', r.id, case when r.due_date > today then 'pre3' else 'late3' end) is not null then k := k + 1; end if;
  end loop; end if; n := n || jsonb_build_object('payment_reminder', k);

  -- 5. welcome message when a deal opens
  k := 0; if office.care_on(v_org, 'welcome') then
  for r in select e.*, c.name client_name from office.engagements e join office.clients c on c.id = e.client_id
      where e.org_id = v_org and c.archived_at is null and not coalesce(c.is_test,false) and e.status in ('active','pending_start')
        and coalesce(e.confirmed_at, e.created_at) > now() - interval '7 days' loop
    select string_agg('• ' || m.title || ' — ' || to_char(m.due_date, 'DD.MM'), E'\n' order by m.due_date) into v_next
      from (select * from office.milestones where client_id = r.client_id and status in ('todo','in_progress','waiting_client') and due_date >= today order by due_date limit 4) m;
    if office.care_draft(v_org, r.client_id, null, 'welcome', 'care_welcome', 'ברוכים הבאים · ' || r.client_name,
      'היי {name}, איזה כיף שאנחנו מתחילים לעבוד יחד! 🎉' || E'\n' || 'הצוות כבר התחיל בחקר העסק שלכם.'
        || coalesce(E'\n\n' || 'מה מחכה לנו בשבועות הקרובים:' || E'\n' || v_next, '')
        || E'\n\n' || 'בכל שאלה — אני כאן.' || sig, 'engagement', r.id) is not null then k := k + 1; end if;
  end loop; end if; n := n || jsonb_build_object('welcome', k);

  -- 6. milestone completed → client update
  k := 0; if office.care_on(v_org, 'milestone_done') then
  for r in select m.*, c.name client_name from office.milestones m join office.clients c on c.id = m.client_id
      where m.org_id = v_org and c.archived_at is null and not coalesce(c.is_test,false) and m.status = 'done' and m.done_at > now() - interval '2 days' and m.mode <> 'monthly' loop
    select title into v_next from office.milestones where client_id = r.client_id and status in ('todo','in_progress','waiting_client') order by due_date limit 1;
    if office.care_draft(v_org, r.client_id, null, 'milestone_done', 'care_milestone', 'עדכון התקדמות · ' || r.title,
      'היי {name}, עדכון קצר: השלמנו את "' || r.title || '" ✅' || coalesce(E'\n' || 'השלב הבא: ' || v_next || '.', '') || sig, 'milestone', r.id) is not null then k := k + 1; end if;
  end loop; end if; n := n || jsonb_build_object('milestone_done', k);

  -- 7. content waiting for client approval > 48h (once a week per client)
  k := 0; if office.care_on(v_org, 'content_nudge') then
  for r in select ci.client_id, c.name client_name, count(*) cnt from office.content_items ci join office.clients c on c.id = ci.client_id
      where ci.org_id = v_org and ci.archived_at is null and c.archived_at is null and not coalesce(c.is_test,false)
        and ci.social_status = 'pending_approval' and ci.updated_at < now() - interval '48 hours' group by 1,2 loop
    if office.care_draft(v_org, r.client_id, null, 'content_nudge', 'care_content', 'תוכן ממתין לאישור הלקוח · ' || r.client_name,
      'היי {name}, יש ' || r.cnt || ' פוסטים שמחכים לאישור שלך כדי שנוכל לתזמן אותם בזמן 📅' || E'\n' || 'אפשר לאשר או לבקש שינויים בהודעה חוזרת.' || sig,
      'client', r.client_id, to_char(today, 'IYYY-IW')) is not null then k := k + 1; end if;
  end loop; end if; n := n || jsonb_build_object('content_nudge', k);

  -- 8. monthly report (1st–3rd of the month)
  k := 0; if office.care_on(v_org, 'monthly_report') and extract(day from today) <= 3 then
  for r in select c.* from office.clients c where c.org_id = v_org and c.archived_at is null and not coalesce(c.is_test,false)
      and exists (select 1 from office.engagements e where e.client_id = c.id and e.status = 'active') loop
    declare pub int; done int; nxt text; begin
      select count(*) into pub from office.content_items where client_id = r.id and published_at >= date_trunc('month', today - 3) and published_at < date_trunc('month', today);
      select count(*) into done from office.milestones where client_id = r.id and done_at >= date_trunc('month', today - 3) and done_at < date_trunc('month', today);
      select string_agg('• ' || title, E'\n') into nxt from (select title from office.milestones where client_id = r.id and status <> 'done' and status <> 'skipped'
        and due_date < date_trunc('month', today) + interval '1 month' order by due_date limit 4) x;
      if office.care_draft(v_org, r.id, null, 'monthly_report', 'care_monthly', 'סיכום חודשי · ' || r.name,
        'היי {name}, סיכום ' || to_char(today - 3, 'MM/YYYY') || ' 📊' || E'\n' || '• פוסטים שפורסמו: ' || pub || E'\n' || '• אבני דרך שהושלמו: ' || done
          || coalesce(E'\n\n' || 'בחודש הקרוב:' || E'\n' || nxt, '') || E'\n\n' || 'נשמח לשמוע מה הכי חשוב לך החודש.' || sig,
        'client', r.id, to_char(today, 'YYYY-MM')) is not null then k := k + 1; end if;
    end;
  end loop; end if; n := n || jsonb_build_object('monthly_report', k);

  -- 9. holiday greetings (2 days before the first day of a major holiday)
  k := 0; if office.care_on(v_org, 'holiday_greeting') then
  for r in select distinct on (split_part(m.title, ':', 1)) m.* from office.calendar_markers m
      where m.org_id = v_org and m.category = 'holiday:major' and m.date = today + 2
        and not exists (select 1 from office.calendar_markers p where p.org_id = v_org and p.category = 'holiday:major' and split_part(p.title, ':', 1) = split_part(m.title, ':', 1) and p.date between m.date - 9 and m.date - 1) loop
    declare cl record; begin
    for cl in select c.* from office.clients c where c.org_id = v_org and c.archived_at is null and not coalesce(c.is_test,false)
        and exists (select 1 from office.engagements e where e.client_id = c.id and e.status in ('active','pending_start')) loop
      if office.care_draft(v_org, cl.id, null, 'holiday_greeting', 'care_holiday', 'ברכת ' || split_part(r.title, ':', 1) || ' · ' || cl.name,
        'היי {name}, לקראת ' || split_part(r.title, ':', 1) || ' — מאחלים לך ולצוות ' || cl.name || ' חג שמח, הרבה בריאות והצלחה 🌟' || sig,
        'client', cl.id, split_part(r.title, ':', 1) || to_char(today, 'YYYY')) is not null then k := k + 1; end if;
    end loop; end;
  end loop; end if; n := n || jsonb_build_object('holiday_greeting', k);

  -- 10. anniversary + 11. satisfaction check every 90 days
  k := 0;
  for r in select e.*, c.name client_name, (today - e.start_date) days from office.engagements e join office.clients c on c.id = e.client_id
      where e.org_id = v_org and e.status = 'active' and c.archived_at is null and not coalesce(c.is_test,false) and e.start_date is not null and e.start_date < today loop
    if office.care_on(v_org, 'anniversary') and r.days >= 365 and to_char(r.start_date, 'MMDD') = to_char(today, 'MMDD') then
      if office.care_draft(v_org, r.client_id, null, 'anniversary', 'care_anniversary', 'שנה של עבודה משותפת · ' || r.client_name,
        'היי {name}, היום בדיוק ' || (r.days / 365) || ' שנה/ים שאנחנו עובדים יחד! 🎂 תודה על האמון — זה ממש לא מובן מאליו.' || sig,
        'engagement', r.id, 'y' || (r.days / 365)) is not null then k := k + 1; end if;
    end if;
    if office.care_on(v_org, 'nps') and r.days >= 85 and r.days % 90 between 0 and 2 then
      if office.care_draft(v_org, r.client_id, null, 'nps', 'care_nps', 'בדיקת שביעות רצון · ' || r.client_name,
        'היי {name}, שאלה קצרה שעוזרת לנו להשתפר: מ-1 עד 10, כמה סביר שתמליץ/י עלינו לחבר? ומה דבר אחד שהיינו יכולים לעשות טוב יותר? 🙏' || sig,
        'engagement', r.id, 'q' || (r.days / 90)) is not null then k := k + 1; end if;
    end if;
  end loop; n := n || jsonb_build_object('anniversary_nps', k);

  -- 12. after a client meeting
  k := 0; if office.care_on(v_org, 'meeting_followup') then
  for r in select mt.* from office.meetings mt where mt.org_id = v_org and coalesce(mt.status,'') not in ('cancelled')
      and (mt.client_id is not null or mt.lead_id is not null) and coalesce(mt.ends_at, mt.starts_at) between now() - interval '20 hours' and now() - interval '1 hour'
      and coalesce(mt.kind,'meeting') not in ('todo','task','studio') loop
    if office.care_draft(v_org, r.client_id, r.lead_id, 'meeting_followup', 'care_meeting_fu', 'תודה על הפגישה · ' || r.title,
      'היי {name}, תודה על הפגישה היום! 🙏 אני מסכם את מה שדיברנו ואשלח בהמשך את הצעדים הבאים.' || sig, 'meeting', r.id) is not null then
      k := k + 1;
      insert into office.notifications(org_id, kind, title, link) values (v_org, 'info', '📝 לשלוח סיכום פגישה: ' || r.title, '/calendar');
    end if;
  end loop; end if; n := n || jsonb_build_object('meeting_followup', k);

  -- 13. client at risk → internal alert (monthly)
  k := 0; if office.care_on(v_org, 'churn_alert') then
  for r in select c.* from office.clients c where c.org_id = v_org and c.archived_at is null and not coalesce(c.is_test,false)
      and exists (select 1 from office.engagements e where e.client_id = c.id and e.status = 'active')
      and (exists (select 1 from office.payments p where p.client_id = c.id and p.status in ('scheduled','link_created','partial') and p.due_date < today - 14)
        or (c.created_at < now() - interval '30 days'
          and not exists (select 1 from office.content_items ci where ci.client_id = c.id and ci.updated_at > now() - interval '30 days')
          and not exists (select 1 from office.milestones m where m.client_id = c.id and m.updated_at > now() - interval '30 days'))) loop
    if office.care_alert(v_org, 'churn_alert', 'client', r.id, to_char(today, 'YYYY-MM'), '⚠️ לקוח בסיכון: ' || r.name || ' — תשלום באיחור או חודש בלי פעילות', '/clients/' || r.id) then k := k + 1; end if;
  end loop; end if; n := n || jsonb_build_object('churn_alert', k);

  return n;
end $$;

grant execute on function public.office_worker_care_tick(text) to anon, authenticated;

-- office-side: list + toggle rules
create or replace function public.office_care_rules() returns jsonb language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships; begin
  m := office.ctx();
  return jsonb_build_object(
    'rules', coalesce((select jsonb_object_agg(key, enabled) from office.care_rules where org_id = m.org_id), '{}'::jsonb),
    'stats', coalesce((select jsonb_object_agg(rule, jsonb_build_object('n', n, 'last', last)) from (
      select rule, count(*) n, max(created_at) last from office.care_log where org_id = m.org_id and created_at > now() - interval '30 days' group by rule) s), '{}'::jsonb));
end $$;
grant execute on function public.office_care_rules() to authenticated;

create or replace function office.act_care(m office.memberships, p_action text, p_payload jsonb) returns jsonb language plpgsql security definer set search_path = office, public as $$
begin
  if p_action <> 'care_rule_set' then return '"__nohandle"'::jsonb; end if;
  if m.role not in ('owner','admin') then raise exception 'forbidden'; end if;
  insert into office.care_rules(org_id, key, enabled) values (m.org_id, p_payload->>'key', (p_payload->>'enabled')::boolean)
  on conflict (org_id, key) do update set enabled = excluded.enabled, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

insert into office.action_permissions(action, roles, description) values ('care_rule_set', array['owner','admin']::office.role[], 'הפעלה/כיבוי אוטומציית שירות') on conflict (action) do nothing;

create or replace function public.office_action(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path to 'office', 'public' as $fn$
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
  if r = '"__nohandle"'::jsonb then r := office.act_journey(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_calendar(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_meeting_link(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then r := office.act_care(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then raise exception 'unknown_action:%', p_action; end if;
  return r;
end $fn$;
