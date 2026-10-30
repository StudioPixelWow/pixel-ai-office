insert into office.workflow_templates(key, name, description, steps) values ('content_month', 'גאנט תוכן חודשי', 'תוכנית פוסטים חודשית ללקוח ריטיינר: רעיון, טקסט בשפת הלקוח, פרומפט קריאייטיב, חגים ו-RTM',
 jsonb_build_array(
  jsonb_build_object('key','plan','kind','ai','agent','social_manager','caps',jsonb_build_array('generate_text'),'title','תכנון חודש תוכן וכתיבת פוסטים','output_kind','content_plan','max_tokens',14000,
    'instruction','בנה את תוכנית התוכן לחודש לפי ההקשר: לכל משבצת ב-slots כתוב פוסט אחד. השתמש רק בתאריכים מ-allowed_dates. אם יש חג/יום מיוחד בשבוע — הזז את המשבצת הקרובה לתאריך הרלוונטי (או לערב החג) והתאם את הפוסט אליו (slot_kind="holiday", marker=שם האירוע). בימים המסומנים no_marketing אין פוסטים. פריטי RTM שאושרו — שלב כפוסט (slot_kind="rtm"). גוון בין עמודי התוכן והפורמטים (רילס, קרוסלה, פוסט תמונה, סטורי). כתוב בשפת הרשתות של הלקוח כפי שכוילה בתיק הלקוח (social_voice): פתיח, אורך, אימוג׳י, האשטגים. כל post_text מוכן לפרסום. creative_prompt באנגלית, תיאור ויזואלי בלבד בלי טקסט בתמונה, בשפה הוויזואלית והצבעים של הלקוח.'),
  jsonb_build_object('key','save','kind','tool:save_content_plan','agent','social_manager','title','הצבת הפוסטים בגאנט לאישורך','depends',jsonb_build_array('plan'))))
on conflict (key) do update set name = excluded.name, description = excluded.description, steps = excluded.steps;

create or replace function office.act_content(m office.memberships, p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare c office.clients; ci office.content_items; v_month date; v_end date; v_ppw int; v_days int[]; v_markers jsonb; v_allowed jsonb; v_slots jsonb; v_rtm jsonb;
  v_req uuid; v_wf uuid; v_idem text; d date; n int := 0; v_ids uuid[]; v_st text;
begin
  if p_action = 'start_content_month' then
    select * into c from office.clients where id = (p->>'client_id')::uuid and org_id = m.org_id;
    if c.id is null then raise exception 'not_found:client'; end if;
    if not office.can_client(m, c.id) then raise exception 'forbidden:client'; end if;
    v_month := date_trunc('month', coalesce(nullif(p->>'month','')||'-01', to_char(now() at time zone 'Asia/Jerusalem','YYYY-MM-01'))::date)::date;
    v_end := (v_month + interval '1 month - 1 day')::date;
    v_ppw := greatest(1, least(7, coalesce((p->>'posts_per_week')::int, 3)));
    v_days := coalesce((select array_agg(x::int) from jsonb_array_elements_text(p->'days') x), case v_ppw when 1 then '{2}'::int[] when 2 then '{0,3}'::int[] when 3 then '{0,2,4}'::int[] when 4 then '{0,1,3,4}'::int[] else '{0,1,2,3,4}'::int[] end);
    select coalesce(jsonb_agg(jsonb_build_object('date', date, 'title', title, 'kind', kind, 'no_marketing', no_marketing, 'category', category) order by date), '[]') into v_markers
      from office.calendar_markers where org_id = m.org_id and date between v_month - 3 and v_end + 3;
    select coalesce(jsonb_agg(to_char(g,'YYYY-MM-DD') order by g), '[]') into v_allowed from generate_series(v_month, v_end, interval '1 day') g
      where extract(dow from g) <> 6 and not exists (select 1 from office.calendar_markers k where k.org_id = m.org_id and k.date = g::date and (k.no_marketing or k.title ilike '%כיפור%'));
    v_slots := '[]';
    for d in select g::date from generate_series(v_month, v_end, interval '1 day') g where extract(dow from g)::int = any(v_days) loop
      if v_allowed ? to_char(d,'YYYY-MM-DD') then v_slots := v_slots || to_jsonb(to_char(d,'YYYY-MM-DD'));
      elsif v_allowed ? to_char(d+1,'YYYY-MM-DD') and d+1 <= v_end then v_slots := v_slots || to_jsonb(to_char(d+1,'YYYY-MM-DD')); end if;
    end loop;
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'event', event_title, 'idea', idea, 'when', event_at, 'sensitivities', sensitivities)), '[]') into v_rtm
      from office.rtm_items where org_id = m.org_id and (client_id = c.id or client_id is null) and status in ('accepted','suggested') and coalesce(event_at, published_at, created_at) between v_month - 7 and v_end + 1;
    v_idem := 'content:' || c.id || ':' || to_char(v_month,'YYYY-MM') || ':' || to_char(now(),'YYYYMMDDHH24MI');
    insert into office.requests(org_id, source, mode, text, client_id, scope, status, created_by, idempotency_key)
    values (m.org_id, 'manual', 'work', 'גאנט תוכן ' || to_char(v_month,'MM/YYYY') || ': ' || c.name, c.id, 'client', 'running', m.user_id, v_idem)
    on conflict do nothing returning id into v_req;
    if v_req is null then select id into v_req from office.requests where org_id = m.org_id and idempotency_key = v_idem; end if;
    v_wf := office.instantiate_workflow(m.org_id, v_req, 'content_month', c.id, null,
      jsonb_build_object('company', c.name, 'month', to_char(v_month,'YYYY-MM'), 'posts_per_week', v_ppw, 'slots', v_slots, 'allowed_dates', v_allowed, 'markers', v_markers, 'rtm', v_rtm,
        'platforms', coalesce(p->'platforms', '["facebook","instagram"]'::jsonb), 'notes', p->>'notes'),
      v_idem, null, null, c.name);
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'client',c.id::text,null,p);
    return jsonb_build_object('request_id', v_req, 'workflow_id', v_wf, 'slots', jsonb_array_length(v_slots), 'note', 'הסוכנים מתכננים את החודש — הפוסטים יופיעו בגאנט לאישורך');
  elsif p_action = 'update_content_item' then
    select * into ci from office.content_items where id = (p->>'id')::uuid and org_id = m.org_id;
    if ci.id is null then raise exception 'not_found'; end if;
    if not office.can_client(m, ci.client_id) then raise exception 'forbidden:client'; end if;
    update office.content_items set
      topic = coalesce(nullif(p->>'topic',''), topic), idea = coalesce(p->>'idea', idea), post_text = coalesce(p->>'post_text', post_text), hook = coalesce(p->>'hook', hook), cta = coalesce(p->>'cta', cta),
      hashtags = coalesce((select array_agg(x) from jsonb_array_elements_text(p->'hashtags') x), hashtags), format = coalesce(nullif(p->>'format',''), format),
      platforms = coalesce((select array_agg(x) from jsonb_array_elements_text(p->'platforms') x), platforms), creative_prompt = coalesce(p->>'creative_prompt', creative_prompt),
      social_status = case when p ? 'post_text' and social_status in ('idea') then 'writing' else social_status end, updated_at = now(), version = version + 1
    where id = ci.id;
    return jsonb_build_object('id', ci.id);
  elsif p_action = 'content_set_status' then
    v_st := p->>'status';
    if v_st not in ('idea','writing','design','pending_approval','approved','scheduled','published','not_published') then raise exception 'bad_status'; end if;
    v_ids := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p->'ids', jsonb_build_array(p->>'id'))) x), '{}');
    update office.content_items set social_status = v_st,
      approval_status = case when v_st in ('approved','scheduled','published') then 'approved' when v_st = 'pending_approval' then 'pending' else approval_status end,
      production_status = case when v_st in ('approved','scheduled','published') then 'approved' when v_st = 'pending_approval' then 'in_review' else production_status end,
      publish_status = case when v_st = 'scheduled' then 'scheduled' when v_st = 'published' then 'published' when v_st = 'not_published' then 'not_published' else publish_status end,
      published_at = case when v_st = 'published' then coalesce(published_at, now()) else published_at end, updated_at = now(), version = version + 1
    where org_id = m.org_id and id = any(v_ids) and office.can_client(m, client_id);
    get diagnostics n = row_count;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'content_item',array_to_string(v_ids,','),null,p);
    return jsonb_build_object('updated', n);
  elsif p_action = 'content_mark_published' then
    select * into ci from office.content_items where id = (p->>'id')::uuid and org_id = m.org_id;
    if ci.id is null then raise exception 'not_found'; end if;
    if not office.can_client(m, ci.client_id) then raise exception 'forbidden:client'; end if;
    if coalesce(p->>'url','') <> '' and p->>'url' !~ '^https://' then raise exception 'bad_url'; end if;
    update office.content_items set social_status = 'published', publish_status = 'published', published_url = nullif(p->>'url',''),
      published_at = coalesce(nullif(p->>'published_at','')::timestamptz, now()), updated_at = now(), version = version + 1 where id = ci.id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'content_item',ci.id::text,null,p);
    return jsonb_build_object('id', ci.id);
  end if;
  return '"__nohandle"'::jsonb;
end $$;
revoke execute on function office.act_content(office.memberships, text, jsonb) from public, anon, authenticated;

create or replace function public.office_action(p_action text, p_payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
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
  if r = '"__nohandle"'::jsonb then raise exception 'unknown_action:%', p_action; end if;
  return r;
end $$;
revoke execute on function public.office_action(text, jsonb) from anon, public;
grant execute on function public.office_action(text, jsonb) to authenticated;

-- Worker: place the AI plan into the Gantt as drafts pending the owner's approval (replaces earlier unapproved AI drafts of that month).
create or replace function public.office_worker_save_content_plan(p_secret text, p_task uuid, p_lease uuid, p_plan jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs; v_month date; v_end date; it jsonb; d date; n int := 0; v_allowed jsonb;
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  if t.client_id is null then raise exception 'plan_without_client'; end if;
  v_month := (coalesce(t.inputs->'params'->>'month', to_char(now(),'YYYY-MM')) || '-01')::date;
  v_end := (v_month + interval '1 month - 1 day')::date;
  v_allowed := coalesce(t.inputs->'params'->'allowed_dates', '[]');
  delete from office.content_items where org_id = t.org_id and client_id = t.client_id and plan_month = v_month and generated_by = 'ai'
    and social_status in ('idea','pending_approval') and creative_blob_id is null and published_url is null;
  for it in select * from jsonb_array_elements(coalesce(p_plan->'posts','[]')) loop
    d := nullif(it->>'date','')::date;
    if d is null or d < v_month or d > v_end then continue; end if;
    -- never on Shabbat or a no-marketing day: move to the next allowed date
    while not (v_allowed ? to_char(d,'YYYY-MM-DD')) and d <= v_end loop d := d + 1; end loop;
    if d > v_end then continue; end if;
    insert into office.content_items(org_id, client_id, topic, idea, post_text, hook, cta, pillar, hashtags, format, channel, platforms, creative_prompt, slot_kind, marker_title, rtm_item_id,
      due_at, social_status, approval_status, production_status, plan_month, generated_by, owner_agent, brief, sort)
    values (t.org_id, t.client_id, left(coalesce(it->>'title', it->>'idea', 'פוסט'), 200), it->>'idea', it->>'post_text', it->>'hook', it->>'cta', it->>'pillar',
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(it->'hashtags','[]')) x), '{}'), it->>'format', coalesce(it->'platforms'->>0, 'instagram'),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(it->'platforms','[]')) x), '{}'), it->>'creative_prompt', coalesce(nullif(it->>'slot_kind',''),'regular'),
      nullif(it->>'marker',''), nullif(it->>'rtm_id','')::uuid,
      ((d::text || ' ' || coalesce(nullif(it->>'time',''),'10:00'))::timestamp at time zone 'Asia/Jerusalem'), 'pending_approval', 'pending', 'in_review', v_month, 'ai', t.agent_id, it->>'why', n);
    n := n + 1;
  end loop;
  perform office.emit(t.org_id, 'content.plan_ready', 'גאנט התוכן מוכן — ' || n || ' פוסטים ממתינים לאישורך', t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
  insert into office.notifications(org_id, kind, title, link) values (t.org_id, 'approval', 'גאנט תוכן ' || to_char(v_month,'MM/YYYY') || ' — ' || n || ' פוסטים לאישורך', '/content?client=' || t.client_id || '&m=' || to_char(v_month,'YYYY-MM'));
  return jsonb_build_object('posts', n, 'month', to_char(v_month,'YYYY-MM'));
end $$;
revoke execute on function public.office_worker_save_content_plan(text,uuid,uuid,jsonb) from public;
grant execute on function public.office_worker_save_content_plan(text,uuid,uuid,jsonb) to anon, authenticated;
