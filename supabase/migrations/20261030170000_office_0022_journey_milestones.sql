-- Lead → proposal → signature → deal (engagement) → client → research → milestones.
-- One-time services get a milestone plan from the start date; retainers get the same monthly milestones every month.

create table if not exists office.service_catalog (key text primary key, label text not null, kind text not null check (kind in ('retainer','one_time')));
insert into office.service_catalog(key, label, kind) values
 ('strategy','אסטרטגיה ותכנון','retainer'),('social','ניהול סושיאל','retainer'),('campaigns','ניהול קמפיינים','retainer'),('seo','SEO — קידום אורגני','retainer'),
 ('geo','GEO / AEO — מנועי AI','retainer'),('website_care','ניהול ותחזוקת אתר','retainer'),('analytics','מדידה ודיווח','retainer'),('reputation','ניהול מוניטין','retainer'),
 ('branding','מיתוג','one_time'),('website','בניית אתר','one_time'),('landing','דף נחיתה','one_time'),('production','הפקת צילום / וידאו','one_time'),('campaign_setup','הקמת קמפיין','one_time'),
 ('onboarding','הקמת לקוח','one_time'),('podcast','הקלטת פודקאסט','one_time')
on conflict (key) do update set label = excluded.label, kind = excluded.kind;

create table if not exists office.milestone_templates (
  service_key text not null references office.service_catalog(key), mode text not null check (mode in ('one_time','monthly')), seq int not null,
  title text not null, offset_days int, day_of_month int, agent text, needs_client boolean not null default false, primary key (service_key, mode, seq));

create table if not exists office.milestones (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references office.organizations(id), client_id uuid not null references office.clients(id),
  engagement_id uuid references office.engagements(id), service_key text, mode text not null default 'one_time' check (mode in ('one_time','monthly','custom')),
  period_month date, seq int not null default 0, title text not null, due_date date, agent text, needs_client boolean not null default false,
  status text not null default 'todo' check (status in ('todo','in_progress','waiting_client','done','skipped')), notes text,
  done_at timestamptz, done_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create unique index if not exists milestones_uq on office.milestones(engagement_id, service_key, mode, coalesce(period_month,'2000-01-01'::date), seq) where engagement_id is not null;
create index if not exists milestones_client on office.milestones(org_id, client_id, due_date);
alter table office.milestones enable row level security; alter table office.milestone_templates enable row level security; alter table office.service_catalog enable row level security;

insert into office.milestone_templates(service_key, mode, seq, title, offset_days, day_of_month, agent, needs_client) values
 ('onboarding','one_time',1,'פגישת התנעה וקבלת חומרים',0,null,'account_manager',true),
 ('onboarding','one_time',2,'מחקר לקוח ותיק מותג',2,null,'brand_strategist',false),
 ('onboarding','one_time',3,'אישור תיק הלקוח והידע',5,null,'knowledge_manager',false),
 ('website','one_time',1,'אפיון ומבנה עמודים',3,null,'web_builder',false),
 ('website','one_time',2,'קבלת חומרים, תכנים וגישות',5,null,'account_manager',true),
 ('website','one_time',3,'עיצוב דף הבית לאישור',14,null,'graphic_designer',false),
 ('website','one_time',4,'אישור עיצוב ע״י הלקוח',17,null,'account_manager',true),
 ('website','one_time',5,'עיצוב עמודים פנימיים',24,null,'graphic_designer',false),
 ('website','one_time',6,'פיתוח רספונסיבי',38,null,'web_builder',false),
 ('website','one_time',7,'תוכן, SEO בסיסי ומדידה',42,null,'seo_specialist',false),
 ('website','one_time',8,'QA מובייל, דסקטופ ונגישות',46,null,'qa_brand',false),
 ('website','one_time',9,'אישור סופי של הלקוח',49,null,'account_manager',true),
 ('website','one_time',10,'עלייה לאוויר',52,null,'web_builder',false),
 ('website','one_time',11,'הדרכה ומסירה',55,null,'account_manager',false),
 ('landing','one_time',1,'בריף ומסר מרכזי',1,null,'copywriter',false),
 ('landing','one_time',2,'קופי לאישור',4,null,'copywriter',true),
 ('landing','one_time',3,'עיצוב הדף',8,null,'graphic_designer',false),
 ('landing','one_time',4,'אישור לקוח',10,null,'account_manager',true),
 ('landing','one_time',5,'פיתוח, טופס לידים ומדידה',14,null,'web_builder',false),
 ('landing','one_time',6,'QA ועלייה לאוויר',16,null,'qa_brand',false),
 ('branding','one_time',1,'שאלון ואפיון מותג',2,null,'brand_strategist',true),
 ('branding','one_time',2,'מחקר מתחרים וכיוונים',7,null,'competitor_researcher',false),
 ('branding','one_time',3,'הצגת 3 כיווני לוגו',14,null,'art_director',false),
 ('branding','one_time',4,'בחירת כיוון ע״י הלקוח',17,null,'account_manager',true),
 ('branding','one_time',5,'פיתוח שפה גרפית',24,null,'graphic_designer',false),
 ('branding','one_time',6,'חוברת מותג ומסירת קבצים',30,null,'deck_designer',false),
 ('production','one_time',1,'בריף וקונספט',2,null,'creator',false),
 ('production','one_time',2,'שוט ליסט / תסריט לאישור',5,null,'scriptwriter',true),
 ('production','one_time',3,'תיאום לוקיישן ויום צילום',8,null,'project_manager',true),
 ('production','one_time',4,'יום צילום',12,null,'project_manager',false),
 ('production','one_time',5,'עריכה — גרסה ראשונה',18,null,'video_editor',false),
 ('production','one_time',6,'תיקונים ואישור לקוח',21,null,'account_manager',true),
 ('production','one_time',7,'מסירה בפורמטים לכל ערוץ',23,null,'video_editor',false),
 ('campaign_setup','one_time',1,'מחקר קהלים ומילות מפתח',2,null,'audience_researcher',false),
 ('campaign_setup','one_time',2,'קבלת גישות לחשבונות מודעות',3,null,'account_manager',true),
 ('campaign_setup','one_time',3,'מבנה קמפיינים וקריאייטיב',6,null,'meta_campaigner',false),
 ('campaign_setup','one_time',4,'הגדרת מדידה והמרות',7,null,'measurement_expert',false),
 ('campaign_setup','one_time',5,'אישור לקוח לעלייה',9,null,'account_manager',true),
 ('campaign_setup','one_time',6,'עלייה לאוויר',10,null,'meta_campaigner',false),
 ('campaign_setup','one_time',7,'בדיקת 72 שעות ראשונות',13,null,'performance_analyst',false),
 ('strategy','monthly',1,'תוכנית עבודה ויעדים לחודש',1,1,'brand_strategist',false),
 ('strategy','monthly',2,'פגישת עבודה חודשית עם הלקוח',null,5,'account_manager',true),
 ('social','monthly',1,'דוח ביצועים סושיאל (חודש קודם)',null,3,'social_manager',false),
 ('social','monthly',2,'גאנט תוכן לחודש הבא',null,18,'gantt_builder',false),
 ('social','monthly',3,'אישור הגאנט ע״י הלקוח',null,22,'account_manager',true),
 ('social','monthly',4,'קריאייטיבים לכל הפוסטים',null,26,'graphic_designer',false),
 ('social','monthly',5,'בקרת פרסום וקהילה',null,28,'community_manager',false),
 ('campaigns','monthly',1,'דוח קמפיינים חודשי',null,3,'performance_analyst',false),
 ('campaigns','monthly',2,'בדיקת תקציב והתאמות',null,7,'media_planner',false),
 ('campaigns','monthly',3,'רענון קריאייטיבים',null,14,'meta_campaigner',false),
 ('campaigns','monthly',4,'אופטימיזציה אמצע חודש',null,16,'google_campaigner',false),
 ('seo','monthly',1,'מאמרים מקצועיים לחודש',null,10,'article_writer',false),
 ('seo','monthly',2,'SEO טכני ועדכונים',null,15,'seo_specialist',false),
 ('seo','monthly',3,'עדכון Google Business',null,20,'seo_specialist',false),
 ('seo','monthly',4,'מעקב מיקומים',null,28,'seo_specialist',false),
 ('geo','monthly',1,'בדיקת נראות במנועי AI',null,12,'seo_specialist',false),
 ('geo','monthly',2,'תוכן מובנה למנועי AI',null,22,'article_writer',false),
 ('website_care','monthly',1,'עדכוני תוספים וגיבוי',null,5,'web_builder',false),
 ('website_care','monthly',2,'בדיקת מהירות וזמינות',null,15,'qa_brand',false),
 ('analytics','monthly',1,'דוח חודשי מסכם ללקוח',null,4,'measurement_expert',false),
 ('analytics','monthly',2,'המלצות לחודש הבא',null,6,'performance_analyst',false),
 ('reputation','monthly',1,'ניטור ומענה לביקורות',null,10,'community_manager',false),
 ('reputation','monthly',2,'דוח מוניטין',null,25,'community_manager',false)
on conflict (service_key, mode, seq) do update set title = excluded.title, offset_days = excluded.offset_days, day_of_month = excluded.day_of_month, agent = excluded.agent, needs_client = excluded.needs_client;

-- services of an engagement = entitlements + the labels/keys written on the accepted proposal
create or replace function office.engagement_services(en office.engagements) returns text[] language sql stable security definer set search_path = office, public as $$
  select array(select distinct k from (
    select service_key k from office.service_entitlements where engagement_id = en.id
    union select c.key from jsonb_array_elements_text(coalesce(en.accepted_snapshot->'content'->'services','[]')) s join office.service_catalog c on c.label = s.value or c.key = s.value
  ) x where k is not null) $$;

create or replace function office.ensure_milestones(p_engagement uuid, p_month date default null) returns int language plpgsql security definer set search_path = office, public as $$
declare en office.engagements; v_start date; v_month date; n int := 0; c int; svc text[];
begin
  select * into en from office.engagements where id = p_engagement; if en.id is null then return 0; end if;
  v_start := coalesce(en.start_date, (en.created_at at time zone 'Asia/Jerusalem')::date);
  svc := office.engagement_services(en);
  -- one-time plan (incl. onboarding for every new deal)
  insert into office.milestones(org_id, client_id, engagement_id, service_key, mode, seq, title, due_date, agent, needs_client)
  select en.org_id, en.client_id, en.id, t.service_key, 'one_time', t.seq, t.title, v_start + coalesce(t.offset_days,0), t.agent, t.needs_client
    from office.milestone_templates t where t.mode = 'one_time' and (t.service_key = 'onboarding' or t.service_key = any(svc))
  on conflict do nothing; get diagnostics c = row_count; n := n + c;
  -- monthly plan for retainer services
  if en.status in ('active','pending_start') then
    v_month := date_trunc('month', coalesce(p_month, (now() at time zone 'Asia/Jerusalem')::date))::date;
    if v_month < date_trunc('month', v_start)::date then v_month := date_trunc('month', v_start)::date; end if;
    insert into office.milestones(org_id, client_id, engagement_id, service_key, mode, period_month, seq, title, due_date, agent, needs_client)
    select en.org_id, en.client_id, en.id, t.service_key, 'monthly', v_month, t.seq, t.title,
      greatest(v_start, v_month + least(coalesce(t.day_of_month,1), extract(day from (v_month + interval '1 month - 1 day'))::int) - 1), t.agent, t.needs_client
      from office.milestone_templates t where t.mode = 'monthly' and t.service_key = any(svc)
    on conflict do nothing; get diagnostics c = row_count; n := n + c;
  end if;
  return n;
end $$;

-- the deal: client (if new) + engagement + milestones + research kick-off. Used by the internal confirm and by the client's signature.
create or replace function office.engage_proposal(p_pv uuid, p_user uuid default null, p_start date default null, p_auto_research boolean default true) returns jsonb language plpgsql security definer set search_path = office, public as $$
declare pv office.proposal_versions; pr office.proposals; v_client uuid; v_id uuid; v_new boolean := false; l office.leads; v_site text; v_req uuid;
begin
  select * into pv from office.proposal_versions where id = p_pv; select * into pr from office.proposals where id = pv.proposal_id;
  select * into l from office.leads where id = pr.lead_id;
  v_client := coalesce(pr.client_id, l.client_id);
  if v_client is null then
    insert into office.clients(org_id, name, industry, status, profile, is_test, created_by)
    values (pr.org_id, coalesce(l.company, pv.content->'client'->>'company', pr.title), l.industry, 'onboarding',
      jsonb_build_object('need', l.need, 'goals', l.goals, 'website', nullif(coalesce(pv.content->'client'->>'website',''),''), 'source', 'proposal'), coalesce(l.is_test,false), p_user)
    returning id into v_client; v_new := true;
  end if;
  update office.proposals set client_id = v_client, status = 'accepted', updated_at = now() where id = pr.id;
  update office.contacts set client_id = v_client where lead_id = pr.lead_id and client_id is null;
  update office.leads set stage = 'engaged', client_id = v_client, updated_at = now() where id = pr.lead_id;
  insert into office.engagements(org_id, client_id, proposal_version_id, accepted_snapshot, status, start_conditions, start_date, setup_fee, monthly_fee, media_budget, confirmed_by, confirmed_at)
  values (pr.org_id, v_client, pv.id, to_jsonb(pv) || jsonb_build_object('items', (select coalesce(jsonb_agg(to_jsonb(i)),'[]') from office.proposal_items i where i.proposal_version_id = pv.id)),
    'pending_start', '["תשלום ראשון","קבלת חומרים וגישות"]'::jsonb, coalesce(p_start, (now() at time zone 'Asia/Jerusalem')::date),
    (pv.price_snapshot->>'setup')::numeric, (pv.price_snapshot->>'monthly')::numeric, (pv.price_snapshot->>'media')::numeric, p_user, now())
  on conflict (proposal_version_id) do nothing returning id into v_id;
  if v_id is null then select id into v_id from office.engagements where proposal_version_id = pv.id;
  else
    perform office.ensure_milestones(v_id);
    insert into office.notifications(org_id, kind, title, link) values (pr.org_id, 'info', 'עסקה חדשה נפתחה: ' || coalesce(l.company, pr.title) || ' · אבני הדרך נוצרו', '/clients/' || v_client);
    perform office.emit(pr.org_id, 'engagement.created', 'נפתחה עסקה: ' || coalesce(l.company, pr.title), null, null, null, 'account_manager', v_client);
    -- research kick-off (only when we know the website, and only once per client)
    select coalesce(profile->>'website','') into v_site from office.clients where id = v_client;
    if p_auto_research and v_site <> '' and not exists(select 1 from office.requests where client_id = v_client and idempotency_key like 'research:%') then
      insert into office.requests(org_id, source, mode, text, client_id, scope, status, idempotency_key)
      values (pr.org_id, 'event', 'work', 'מחקר לקוח מלא אחרי סגירת עסקה: ' || coalesce(l.company, pr.title), v_client, 'client', 'running', 'research:' || v_client || ':deal') returning id into v_req;
      perform office.instantiate_workflow(pr.org_id, v_req, 'client_research', v_client, null, jsonb_build_object('company', coalesce(l.company, pr.title), 'website', v_site), 'research:deal:' || v_client);
    end if;
  end if;
  return jsonb_build_object('engagement_id', v_id, 'client_id', v_client, 'new_client', v_new, 'research_request', v_req);
end $$;

-- signature by the client now opens the deal automatically
create or replace function public.office_public_sign(p_token text, p_name text, p_title text, p_sig_b64 text, p_ua text, p_ip text)
 returns jsonb language plpgsql security definer set search_path to 'office', 'public', 'extensions' as $function$
declare pr office.proposals; pv office.proposal_versions; v_blob uuid; v_deal jsonb;
begin
  pr := office.proposal_by_token(p_token);
  if pr.id is null then raise exception 'link_invalid_or_expired'; end if;
  select * into pv from office.proposal_versions where proposal_id = pr.id and version_no = pr.current_version and review_status = 'approved';
  if pv.id is null then raise exception 'link_invalid_or_expired'; end if;
  if exists(select 1 from office.proposal_signatures where proposal_id = pr.id and version_id = pv.id) then raise exception 'already_signed'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'missing:signer_name'; end if;
  if coalesce(length(p_sig_b64),0) < 200 or length(p_sig_b64) > 800000 then raise exception 'missing:signature'; end if;
  v_blob := office.put_blob(pr.org_id, pr.client_id, null, null, 'signature', 'image/png', p_sig_b64, false);
  insert into office.proposal_signatures(org_id, proposal_id, version_id, signer_name, signer_title, signature_blob_id, content_hash, ip_hash, user_agent)
  values (pr.org_id, pr.id, pv.id, trim(p_name), nullif(trim(coalesce(p_title,'')),''), v_blob, office.version_hash(pv),
          encode(digest(coalesce(p_ip,''), 'sha256'), 'hex'), left(p_ua, 300));
  perform office.audit(pr.org_id,'system','client_signing_link','proposal_signed','proposal',pr.id::text,null,jsonb_build_object('signer', trim(p_name), 'version', pv.version_no));
  perform office.emit(pr.org_id,'proposal.signed','ההצעה נחתמה: '||pr.title||' · '||trim(p_name));
  v_deal := office.engage_proposal(pv.id, null, null, true);
  insert into office.notifications(org_id, kind, title, link) values (pr.org_id, 'approval', 'ההצעה נחתמה ✍ ' || pr.title || ' — העסקה נפתחה, ממתינה להפעלה אחרי תשלום', '/clients/' || (v_deal->>'client_id'));
  return jsonb_build_object('ok', true, 'signed_at', now());
end $function$;

-- actions: confirm a deal manually (signed on paper / by phone), milestones
create or replace function office.act_journey(m office.memberships, a text, p jsonb) returns jsonb language plpgsql security definer set search_path = office, public as $$
declare ms office.milestones; en office.engagements; r jsonb; n int;
begin
  if a not in ('open_deal','milestone_update','milestone_add','milestones_sync') then return '"__nohandle"'::jsonb; end if;
  if a = 'open_deal' then
    if not exists(select 1 from office.proposal_versions v join office.proposals pr on pr.id = v.proposal_id where v.id = (p->>'version_id')::uuid and pr.org_id = m.org_id and v.review_status = 'approved') then raise exception 'version_not_approved'; end if;
    r := office.engage_proposal((p->>'version_id')::uuid, m.user_id, nullif(p->>'start_date','')::date, coalesce((p->>'research')::boolean, true));
    return r;
  elsif a = 'milestone_update' then
    select * into ms from office.milestones where id = (p->>'id')::uuid and org_id = m.org_id for update;
    if ms.id is null then raise exception 'not_found'; end if;
    if not office.can_client(m, ms.client_id) then raise exception 'forbidden:client'; end if;
    update office.milestones set status = coalesce(p->>'status', status), notes = coalesce(p->>'notes', notes), due_date = coalesce(nullif(p->>'due_date','')::date, due_date),
      done_at = case when p->>'status' = 'done' then now() when p->>'status' is not null then null else done_at end, done_by = case when p->>'status' = 'done' then m.user_id else done_by end, updated_at = now() where id = ms.id;
    return jsonb_build_object('ok', true);
  elsif a = 'milestone_add' then
    if not office.can_client(m, (p->>'client_id')::uuid) then raise exception 'forbidden:client'; end if;
    insert into office.milestones(org_id, client_id, engagement_id, service_key, mode, title, due_date, needs_client)
    values (m.org_id, (p->>'client_id')::uuid, nullif(p->>'engagement_id','')::uuid, nullif(p->>'service_key',''), 'custom', p->>'title', nullif(p->>'due_date','')::date, coalesce((p->>'needs_client')::boolean,false));
    return jsonb_build_object('ok', true);
  else
    select * into en from office.engagements where id = (p->>'engagement_id')::uuid and org_id = m.org_id;
    if en.id is null then raise exception 'not_found'; end if;
    n := office.ensure_milestones(en.id, nullif(p->>'month','')::date);
    return jsonb_build_object('added', n);
  end if;
end $$;

-- hook the existing confirm/activate into milestones
create or replace function office.engagement_milestones_trg() returns trigger language plpgsql security definer set search_path = office, public as $$
begin perform office.ensure_milestones(new.id); return new; end $$;
create or replace trigger engagement_milestones after insert or update of status, start_date on office.engagements for each row execute function office.engagement_milestones_trg();

-- worker: roll recurring milestones (current month always; next month from the 25th)
create or replace function public.office_worker_roll_milestones(p_secret text) returns int language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; e record; n int := 0; v_today date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  v_org := office.worker_org(p_secret);
  for e in select id from office.engagements where org_id = v_org and status = 'active' loop
    n := n + office.ensure_milestones(e.id, v_today);
    if extract(day from v_today) >= 25 then n := n + office.ensure_milestones(e.id, (date_trunc('month', v_today) + interval '1 month')::date); end if;
  end loop;
  return n;
end $$;

-- journey read: where is this lead / client in the funnel
create or replace function public.office_journey(p_lead uuid default null, p_client uuid default null) returns jsonb language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships; l office.leads; c office.clients; pr office.proposals; en office.engagements; v_client uuid; v_res jsonb;
begin
  m := office.ctx();
  if p_lead is not null then select * into l from office.leads where id = p_lead and org_id = m.org_id; end if;
  v_client := coalesce(p_client, l.client_id);
  if l.id is null and v_client is not null then select * into l from office.leads where client_id = v_client and org_id = m.org_id order by created_at desc limit 1; end if;
  if v_client is not null then select * into c from office.clients where id = v_client and org_id = m.org_id;
    if not office.can_client(m, c.id) then raise exception 'forbidden:client'; end if; end if;
  select * into pr from office.proposals where org_id = m.org_id and ((l.id is not null and lead_id = l.id) or (c.id is not null and client_id = c.id)) and archived_at is null order by created_at desc limit 1;
  if c.id is not null then select * into en from office.engagements where client_id = c.id order by created_at desc limit 1; end if;
  select jsonb_build_object('running', exists(select 1 from office.requests q join office.task_runs t on t.request_id = q.id where q.client_id = c.id and q.idempotency_key like 'research:%' and t.status in ('queued','running','retrying')),
    'request_id', (select q.id from office.requests q where q.client_id = c.id and q.idempotency_key like 'research:%' order by q.created_at desc limit 1)) into v_res;
  return jsonb_build_object(
    'lead', case when l.id is null then null else jsonb_build_object('id', l.id, 'stage', l.stage, 'company', l.company) end,
    'proposal', case when pr.id is null then null else jsonb_build_object('id', pr.id, 'status', pr.status, 'title', pr.title,
       'signed', exists(select 1 from office.proposal_signatures s where s.proposal_id = pr.id),
       'version_id', (select v.id from office.proposal_versions v where v.proposal_id = pr.id and v.version_no = pr.current_version),
       'approved', exists(select 1 from office.proposal_versions v where v.proposal_id = pr.id and v.version_no = pr.current_version and v.review_status = 'approved')) end,
    'engagement', case when en.id is null then null else jsonb_build_object('id', en.id, 'status', en.status, 'start_date', en.start_date, 'monthly', en.monthly_fee, 'setup', en.setup_fee) end,
    'client', case when c.id is null then null else jsonb_build_object('id', c.id, 'name', c.name, 'status', c.status, 'has_dossier', c.profile ? 'dossier', 'website', c.profile->>'website') end,
    'research', v_res,
    'milestones', case when c.id is null then null else (select jsonb_build_object('total', count(*), 'done', count(*) filter (where status in ('done','skipped')),
       'overdue', count(*) filter (where status not in ('done','skipped') and due_date < (now() at time zone 'Asia/Jerusalem')::date)) from office.milestones where client_id = c.id) end,
    'paid', case when c.id is null then false else exists(select 1 from office.payments where client_id = c.id and status in ('paid','partial')) end);
end $$;

create or replace function public.office_client_milestones(p_client uuid) returns jsonb language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships;
begin
  m := office.ctx();
  if not office.can_client(m, p_client) then raise exception 'forbidden:client'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'engagement_id', x.engagement_id, 'service_key', x.service_key, 'service', coalesce(sc.label, x.service_key), 'mode', x.mode, 'period_month', x.period_month,
      'seq', x.seq, 'title', x.title, 'due_date', x.due_date, 'agent', x.agent, 'agent_name', ad.name, 'needs_client', x.needs_client, 'status', x.status, 'notes', x.notes, 'done_at', x.done_at)
    order by x.mode, x.period_month nulls first, x.due_date, x.seq)
    from office.milestones x left join office.service_catalog sc on sc.key = x.service_key left join office.agent_definitions ad on ad.id = x.agent and ad.org_id = x.org_id
    where x.client_id = p_client and x.org_id = m.org_id and (x.mode <> 'monthly' or x.period_month >= (date_trunc('month', now() at time zone 'Asia/Jerusalem') - interval '2 months')::date)), '[]');
end $$;

insert into office.action_permissions(action, roles, description) values
 ('open_deal', '{owner,admin}', 'פתיחת עסקה מהצעה מאושרת'), ('milestone_update', '{owner,admin,account_manager,employee}', 'עדכון אבן דרך'),
 ('milestone_add', '{owner,admin,account_manager}', 'הוספת אבן דרך'), ('milestones_sync', '{owner,admin,account_manager}', 'יצירת אבני דרך לחודש')
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
  if r = '"__nohandle"'::jsonb then r := office.act_journey(m, p_action, p); end if;
  if r = '"__nohandle"'::jsonb then raise exception 'unknown_action:%', p_action; end if;
  return r;
end $function$;

revoke all on function public.office_journey(uuid, uuid), public.office_client_milestones(uuid) from public, anon;
grant execute on function public.office_journey(uuid, uuid), public.office_client_milestones(uuid) to authenticated;
revoke all on function public.office_worker_roll_milestones(text) from public;
grant execute on function public.office_worker_roll_milestones(text) to anon, authenticated, service_role;
