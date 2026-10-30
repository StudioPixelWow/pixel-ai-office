-- Client research workflow: site crawl → social profiles + content samples → web research (Claude) → ChatGPT research (OpenAI API)
-- → full client dossier (Opus) → knowledge items saved as PENDING for owner approval + asset bank.
insert into office.workflow_templates(key, name, description, steps) values
('client_research','מחקר לקוח מלא ובניית ספריית ידע','אתר → רשתות ודוגמאות תוכן → מחקר רשת → מחקר ChatGPT → תיק לקוח → ספריית ידע לאישור', '[
 {"key":"crawl","title":"סריקת אתר הלקוח","agent":"knowledge_manager","kind":"tool:crawl_site"},
 {"key":"social","title":"רשתות חברתיות ודוגמאות תוכן","agent":"social_manager","kind":"tool:social_scan","depends":["crawl"]},
 {"key":"web","title":"מחקר רשת: מוניטין, תקשורת ומתחרים","agent":"market_researcher","kind":"tool:web_research","depends":["crawl"],"caps":["generate_text"]},
 {"key":"gpt","title":"מחקר עומק ב-ChatGPT","agent":"competitor_researcher","kind":"tool:openai_research","depends":["crawl"]},
 {"key":"dossier","title":"בניית תיק לקוח, שפת מותג וספריית תוכן","agent":"brand_strategist","kind":"ai","depends":["crawl","social","web","gpt"],"caps":["generate_text"],"output_kind":"client_dossier"},
 {"key":"save","title":"שמירת ספריית הידע ובנק הנכסים לאישורך","agent":"knowledge_manager","kind":"tool:save_dossier","depends":["dossier"]}
]')
on conflict (key) do update set name = excluded.name, description = excluded.description, steps = excluded.steps;

insert into office.action_permissions(action, roles, description) values
  ('start_client_research','{owner,admin,account_manager}','הפעלת מחקר לקוח מלא')
on conflict (action) do update set roles = excluded.roles, description = excluded.description;

create or replace function office.act_research(m office.memberships, p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare c office.clients; v_req uuid; v_wf uuid; v_web text; v_soc jsonb; v_idem text;
begin
  if p_action <> 'start_client_research' then return '"__nohandle"'::jsonb; end if;
  select * into c from office.clients where id = (p->>'client_id')::uuid and org_id = m.org_id;
  if c.id is null then raise exception 'not_found:client'; end if;
  if not office.can_client(m, c.id) then raise exception 'forbidden:client'; end if;
  v_web := coalesce(nullif(trim(p->>'website'),''), c.profile->>'website');
  if v_web is not null and v_web !~* '^https?://' then v_web := 'https://' || v_web; end if;
  v_soc := coalesce(c.profile->'socials','{}'::jsonb) || coalesce((select jsonb_object_agg(k, v) from jsonb_each(coalesce(p->'socials','{}'::jsonb)) e(k, v) where coalesce(v #>> '{}','') <> ''), '{}'::jsonb);
  update office.clients set profile = profile || jsonb_strip_nulls(jsonb_build_object('website', v_web, 'socials', v_soc)), updated_at = now() where id = c.id;
  v_idem := 'research:' || c.id || ':' || coalesce(nullif(p->>'run',''), to_char(now(), 'YYYYMMDDHH24MI'));
  insert into office.requests(org_id, source, mode, text, client_id, scope, status, created_by, idempotency_key)
  values (m.org_id, 'manual', 'work', 'מחקר לקוח מלא: ' || c.name, c.id, 'client', 'running', m.user_id, v_idem)
  on conflict do nothing returning id into v_req;
  if v_req is null then select id into v_req from office.requests where org_id = m.org_id and idempotency_key = v_idem; end if;
  v_wf := office.instantiate_workflow(m.org_id, v_req, 'client_research', c.id, null,
    jsonb_build_object('company', c.name, 'industry', c.industry, 'website', v_web, 'socials', v_soc, 'notes', p->>'notes',
      'instruction', 'בנה תיק לקוח מלא ומדויק מכל חומרי המחקר: מותג (טון, בידול, מסרים, צבעים, פונטים, לוגו), העסק והשירותים, שאלות נפוצות, קהלי יעד, מתחרים, נוכחות דיגיטלית לכל רשת, מוניטין, ' ||
        'שפת הרשתות (social_voice) מתוך דוגמאות התוכן — סגנון, אורך טקסט, אימוג׳י, האשטגים, הוקים, פורמטים שעובדים, ויזואל, כן/לא ו-3–5 דוגמאות מובילות עם הסבר, ' ||
        'וספריית תוכן: 5–7 עמודי תוכן, 30 רעיונות לפוסטים בשפת הלקוח, 15–25 ביטויי SEO ו-10–15 שאלות למנועי AI. סמן הערכות כהערכה, אל תמציא, והוסף שאלות פתוחות ללקוח. ' ||
        'כל מקור שבו השתמשת — ברשימת sources.' || coalesce(' הערות טל: ' || nullif(p->>'notes',''), '')),
    v_idem, null, null, c.name);
  perform office.audit(m.org_id,'user',m.user_id::text,p_action,'client',c.id::text,null,p);
  return jsonb_build_object('request_id', v_req, 'workflow_id', v_wf, 'note', 'מחקר הלקוח התחיל — התוצאות יחכו לאישורך בלשונית "ידע" של הלקוח');
end $$;
revoke execute on function office.act_research(office.memberships, text, jsonb) from public, anon, authenticated;

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
  if r = '"__nohandle"'::jsonb then raise exception 'unknown_action:%', p_action; end if;
  return r;
end $$;
revoke execute on function public.office_action(text, jsonb) from anon, public;
grant execute on function public.office_action(text, jsonb) to authenticated;

-- Worker: persist the dossier as PENDING knowledge items (owner approves) + client profile/brand fields + asset bank.
create or replace function public.office_worker_save_dossier(p_secret text, p_task uuid, p_lease uuid, p_dossier jsonb, p_extra jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; t office.task_runs; d jsonb := coalesce(p_dossier,'{}'::jsonb); x jsonb := coalesce(p_extra,'{}'::jsonb); n int := 0; a int := 0; s jsonb; v_src text; it jsonb;
  procedure_note text := 'נוצר ע״י מחקר לקוח אוטומטי · ממתין לאישור';
begin
  v_org := office.worker_org(p_secret);
  t := office.lease_ok(p_task, p_lease);
  if t.client_id is null then raise exception 'research_without_client'; end if;
  v_src := x->>'website';
  -- one knowledge item per section, PENDING
  for s in select * from jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('k','brand','t','ספר מותג — טון, בידול ומסרים','b', concat_ws(E'\n', 'טון: '||(d->'brand'->>'voice'), 'מילות טון: '||(select string_agg(v,', ') from jsonb_array_elements_text(coalesce(d->'brand'->'tone_words','[]')) v),
         'ערכים: '||(select string_agg(v,', ') from jsonb_array_elements_text(coalesce(d->'brand'->'values','[]')) v), 'בידול:', (select string_agg('- '||v, E'\n') from jsonb_array_elements_text(coalesce(d->'brand'->'differentiators','[]')) v),
         'מסרים:', (select string_agg('- '||v, E'\n') from jsonb_array_elements_text(coalesce(d->'brand'->'messages','[]')) v),
         'צבעים: '||(select string_agg((c->>'hex')||coalesce(' '||(c->>'role'),''),', ') from jsonb_array_elements(coalesce(d->'brand'->'colors','[]')) c), 'פונטים: '||(select string_agg(v,', ') from jsonb_array_elements_text(coalesce(d->'brand'->'fonts','[]')) v),
         'לוגו: '||coalesce(d->'brand'->>'logo_url', x->>'logo'))),
      jsonb_build_object('k','fact','t','העסק, השירותים ופרטי קשר','b', concat_ws(E'\n', d->'business'->>'about', (select string_agg('- '||(v->>'name')||' — '||(v->>'description'), E'\n') from jsonb_array_elements(coalesce(d->'business'->'services','[]')) v),
         'מיקומים: '||(select string_agg(v,', ') from jsonb_array_elements_text(coalesce(d->'business'->'locations','[]')) v), 'טלפונים: '||(select string_agg(v,', ') from jsonb_array_elements_text(coalesce(d->'business'->'contact'->'phones','[]')) v),
         'מיילים: '||(select string_agg(v,', ') from jsonb_array_elements_text(coalesce(d->'business'->'contact'->'emails','[]')) v), 'כתובת: '||(d->'business'->'contact'->>'address'))),
      jsonb_build_object('k','fact','t','שאלות נפוצות','b', (select string_agg('ש: '||(v->>'q')||E'\nת: '||(v->>'a'), E'\n\n') from jsonb_array_elements(coalesce(d->'business'->'faq','[]')) v)),
      jsonb_build_object('k','guideline','t','קהלי יעד ופרסונות','b', (select string_agg('### '||(v->>'name')||E'\nכאבים: '||coalesce((select string_agg(p,', ') from jsonb_array_elements_text(coalesce(v->'pains','[]')) p),'')||E'\nמניעים: '||coalesce((select string_agg(p,', ') from jsonb_array_elements_text(coalesce(v->'motivations','[]')) p),'')||E'\nערוצים: '||coalesce((select string_agg(p,', ') from jsonb_array_elements_text(coalesce(v->'channels','[]')) p),''), E'\n\n') from jsonb_array_elements(coalesce(d->'audiences','[]')) v)),
      jsonb_build_object('k','fact','t','מתחרים','b', (select string_agg('- '||(v->>'name')||coalesce(' ('||(v->>'url')||')','')||' — חוזקות: '||coalesce(v->>'strengths','')||' · הפער שלנו: '||coalesce(v->>'gap',''), E'\n') from jsonb_array_elements(coalesce(d->'competitors','[]')) v)),
      jsonb_build_object('k','fact','t','נוכחות דיגיטלית','b', (select string_agg('- '||(v->>'network')||coalesce(' '||(v->>'url'),'')||' — '||coalesce(v->>'status','')||'. '||coalesce(v->>'notes','')||' → '||coalesce(v->>'recommendation',''), E'\n') from jsonb_array_elements(coalesce(d->'digital_presence','[]')) v)),
      jsonb_build_object('k','brand','t','שפת הרשתות של הלקוח','b', concat_ws(E'\n', 'סגנון: '||(d->'social_voice'->>'style'), 'אורך טקסט: '||(d->'social_voice'->>'caption_length'), 'אימוג׳י: '||(d->'social_voice'->>'emoji_use'),
         'האשטגים: '||(select string_agg(v,' ') from jsonb_array_elements_text(coalesce(d->'social_voice'->'hashtags','[]')) v), 'הוקים:', (select string_agg('- '||v, E'\n') from jsonb_array_elements_text(coalesce(d->'social_voice'->'hooks','[]')) v),
         'פורמטים שעובדים: '||(select string_agg(v,', ') from jsonb_array_elements_text(coalesce(d->'social_voice'->'formats_that_work','[]')) v), 'ויזואל: '||(d->'social_voice'->>'visual_style'),
         'כן:', (select string_agg('- '||v, E'\n') from jsonb_array_elements_text(coalesce(d->'social_voice'->'do','[]')) v), 'לא:', (select string_agg('- '||v, E'\n') from jsonb_array_elements_text(coalesce(d->'social_voice'->'dont','[]')) v),
         'דוגמאות מובילות:', (select string_agg('- '||(v->>'url')||' — '||(v->>'why'), E'\n') from jsonb_array_elements(coalesce(d->'social_voice'->'top_examples','[]')) v))),
      jsonb_build_object('k','fact','t','מוניטין וביקורות','b', concat_ws(E'\n', d->'reputation'->>'summary', 'דירוג: '||(d->'reputation'->>'rating'), 'חיובי: '||(select string_agg(v,', ') from jsonb_array_elements_text(coalesce(d->'reputation'->'themes_positive','[]')) v), 'שלילי: '||(select string_agg(v,', ') from jsonb_array_elements_text(coalesce(d->'reputation'->'themes_negative','[]')) v))),
      jsonb_build_object('k','guideline','t','ספריית תוכן — עמודים ורעיונות','b', concat_ws(E'\n', '## עמודי תוכן', (select string_agg('- '||(v->>'name')||' — '||coalesce(v->>'description',''), E'\n') from jsonb_array_elements(coalesce(d->'content_library'->'pillars','[]')) v),
         '## רעיונות לפוסטים', (select string_agg(o::text||'. '||(v->>'title')||' ('||coalesce(v->>'format','')||coalesce(' · '||nullif(v->>'pillar',''),'')||') — '||coalesce(v->>'hook',''), E'\n') from jsonb_array_elements(coalesce(d->'content_library'->'post_ideas','[]')) with ordinality q(v, o)))),
      jsonb_build_object('k','guideline','t','ביטויי SEO ושאלות למנועי AI','b', concat_ws(E'\n', '## SEO', (select string_agg('- '||v, E'\n') from jsonb_array_elements_text(coalesce(d->'content_library'->'seo_keywords','[]')) v),
         '## שאלות AEO/GEO', (select string_agg('- '||v, E'\n') from jsonb_array_elements_text(coalesce(d->'content_library'->'aeo_questions','[]')) v))),
      jsonb_build_object('k','decision','t','הזדמנויות ושאלות פתוחות ללקוח','b', concat_ws(E'\n', '## הזדמנויות', (select string_agg('- '||v, E'\n') from jsonb_array_elements_text(coalesce(d->'opportunities','[]')) v),
         '## שאלות פתוחות', (select string_agg('- '||v, E'\n') from jsonb_array_elements_text(coalesce(d->'open_questions','[]')) v))),
      jsonb_build_object('k','source','t','מקורות המחקר','b', (select string_agg('- '||v, E'\n') from jsonb_array_elements_text(coalesce(d->'sources','[]')) v))
    )) loop
    if coalesce(trim(s->>'b'),'') = '' then continue; end if;
    insert into office.knowledge_items(org_id, scope, client_id, kind, title, body, source_url, approval_status)
    values (t.org_id, 'client', t.client_id, s->>'k', '[מחקר] ' || (s->>'t'), (s->>'b') || E'\n\n— ' || procedure_note, v_src, 'pending');
    n := n + 1;
  end loop;
  -- content samples library (one item; each sample also goes to the asset bank)
  if jsonb_array_length(coalesce(x->'samples','[]')) > 0 then
    insert into office.knowledge_items(org_id, scope, client_id, kind, title, body, source_url, approval_status)
    values (t.org_id, 'client', t.client_id, 'brand', '[מחקר] דוגמאות תוכן מהרשתות (' || jsonb_array_length(x->'samples') || ')',
      (select string_agg(o::text || '. [' || coalesce(v->>'network','') || ' · ' || coalesce(v->>'type','') || '] ' || coalesce(v->>'url','') || coalesce(' · ' || (v->>'likes') || ' לייקים','') || coalesce(' · ' || (v->>'views') || ' צפיות','') || E'\n' || left(coalesce(v->>'text',''), 700), E'\n\n') from jsonb_array_elements(x->'samples') with ordinality q(v, o)) || E'\n\n— ' || procedure_note,
      null, 'pending');
    n := n + 1;
    for it in select * from jsonb_array_elements(x->'samples') loop
      if coalesce(it->>'url','') = '' then continue; end if;
      insert into office.client_assets(org_id, client_id, kind, identifier, owner_label, access_status, notes)
      values (t.org_id, t.client_id, 'social_sample', it->>'url', it->>'network', 'public', left(concat_ws(' · ', it->>'type', it->>'date', case when it->>'likes' is not null then (it->>'likes') || ' לייקים' end, left(coalesce(it->>'text',''), 300)), 600))
      on conflict (client_id, kind, identifier) do nothing; a := a + 1;
    end loop;
  end if;
  if jsonb_array_length(coalesce(x->'sample_gaps','[]')) > 0 then
    insert into office.knowledge_items(org_id, scope, client_id, kind, title, body, approval_status)
    values (t.org_id, 'client', t.client_id, 'decision', '[מחקר] להשלמה: דוגמאות מרשתות שדורשות כניסה',
      (select string_agg('- ' || v, E'\n') from jsonb_array_elements_text(x->'sample_gaps') v) || E'\nאפשר להשלים דרך הכרום המחובר שלך, או לחבר Meta לאינסטגרם.', 'pending');
  end if;
  -- asset bank: website, social profiles, logo, site images
  if coalesce(v_src,'') <> '' then insert into office.client_assets(org_id, client_id, kind, identifier, access_status, notes) values (t.org_id, t.client_id, 'website', v_src, 'public', 'נסרק במחקר') on conflict do nothing; a := a + 1; end if;
  for it in select * from jsonb_array_elements(coalesce(x->'socials','[]')) loop
    if coalesce(it->>'url','') = '' then continue; end if;
    insert into office.client_assets(org_id, client_id, kind, identifier, owner_label, access_status, notes)
    values (t.org_id, t.client_id, 'social_profile', it->>'url', it->>'network', case when it->>'status' = 'public' then 'public' else 'unverified' end, coalesce('עוקבים: ' || (it->>'followers'), '')) on conflict do nothing; a := a + 1;
  end loop;
  if coalesce(x->>'logo','') <> '' then insert into office.client_assets(org_id, client_id, kind, identifier, access_status, notes) values (t.org_id, t.client_id, 'logo', x->>'logo', 'public', 'לוגו מהאתר — לאימות מול קבצי מקור') on conflict do nothing; a := a + 1; end if;
  for it in select * from jsonb_array_elements(coalesce(x->'images','[]')) loop
    insert into office.client_assets(org_id, client_id, kind, identifier, access_status, notes) values (t.org_id, t.client_id, 'site_image', it #>> '{}', 'public', 'תמונה מהאתר — לבדיקת זכויות לפני שימוש') on conflict do nothing; a := a + 1;
  end loop;
  -- profile: fill only empty fields (never overwrite what the team wrote)
  update office.clients set profile = jsonb_strip_nulls(jsonb_build_object(
      'voice', d->'brand'->>'voice', 'differentiators', (select string_agg(v, ' · ') from jsonb_array_elements_text(coalesce(d->'brand'->'differentiators','[]')) v),
      'audiences', (select string_agg(v->>'name', ' · ') from jsonb_array_elements(coalesce(d->'audiences','[]')) v),
      'competitors', (select string_agg(v->>'name', ' · ') from jsonb_array_elements(coalesce(d->'competitors','[]')) v),
      'brand_colors', coalesce(d->'brand'->'colors', x->'colors'), 'brand_fonts', coalesce(d->'brand'->'fonts', x->'fonts'), 'logo_url', coalesce(d->'brand'->>'logo_url', x->>'logo'))) || profile
      || jsonb_build_object('research_at', now(), 'research_summary', left(d->>'summary', 1200)),
    updated_at = now() where id = t.client_id;
  perform office.emit(t.org_id, 'client.research_done', 'מחקר לקוח הושלם — ממתין לאישורך', t.id, t.workflow_run_id, t.request_id, t.agent_id, t.client_id);
  insert into office.notifications(org_id, kind, title, link) values (t.org_id, 'approval', 'מחקר לקוח הושלם — ' || n || ' פריטי ידע לאישורך', '/clients/' || t.client_id || '?tab=knowledge');
  return jsonb_build_object('knowledge', n, 'assets', a);
end $$;
revoke execute on function public.office_worker_save_dossier(text,uuid,uuid,jsonb,jsonb) from public;
grant execute on function public.office_worker_save_dossier(text,uuid,uuid,jsonb,jsonb) to anon, authenticated;
