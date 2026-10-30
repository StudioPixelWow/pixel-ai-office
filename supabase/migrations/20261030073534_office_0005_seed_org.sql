-- applied migration: office_0005_seed_org (version 20261030073534)
do $$ declare v_org uuid; begin
  select id into v_org from office.organizations limit 1;
  if v_org is null then
    insert into office.organizations(name, timezone, currency, settings) values ('Pixel Digital Group', 'Asia/Jerusalem', 'ILS',
      jsonb_build_object('departments', jsonb_build_array('pixel_digital','pixel_nadlan','pixel_rest','pixel_lawyer','bakoma'), 'test_numbers', '[]'::jsonb, 'brand_source', 'https://s-pixel.co.il'))
    returning id into v_org;
  end if;
  insert into office.owner_allowlist(email, role, org_id) values ('tal.pixeld@gmail.com', 'owner', v_org) on conflict (email) do nothing;
  insert into office.owner_allowlist(email, role, org_id) values ('office@s-pixel.co.il', 'admin', v_org) on conflict (email) do nothing;
  insert into office.budgets(org_id, scope_type, scope_ref, monthly_limit_usd, hard_stop) values (v_org, 'org', 'org', 150, true) on conflict do nothing;
end $$;
insert into office.system_secrets(name, sha256) values ('worker', 'f86cb753287e3d956d1465e5f95d86a892252da97c364d5c45369e60b96bab45')
on conflict (name) do update set sha256 = excluded.sha256, rotated_at = now();

-- owner-only seeding of agent definitions + first versions from the repo roster (idempotent)
create or replace function public.office_seed_agents(p_agents jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare m office.memberships; a jsonb; n int := 0;
begin
  m := office.ctx();
  if m.role <> 'owner' then raise exception 'owner_only'; end if;
  for a in select * from jsonb_array_elements(p_agents) loop
    insert into office.agent_definitions(id, org_id, number, name, role_title, department, avatar_key, status, current_version, human_owner)
    values (a->>'id', m.org_id, (a->>'number')::int, a->>'name', a->>'role_title', a->>'department', a->>'avatar_key', 'active', 1, m.user_id)
    on conflict (id) do update set number = excluded.number, name = excluded.name, role_title = excluded.role_title, department = excluded.department, avatar_key = excluded.avatar_key;
    insert into office.agent_versions(agent_id, version_no, spec, instructions, preferred_model, tools, required_capabilities, triggers, limits, eval_tasks, change_note, created_by)
    values (a->>'id', 1, a->'spec', a->>'instructions', a->>'preferred_model', array(select jsonb_array_elements_text(a->'tools')),
      array(select jsonb_array_elements_text(a->'required_capabilities')), coalesce(a->'triggers','[]'::jsonb), coalesce(a->'limits','{}'::jsonb), coalesce(a->'eval_tasks','[]'::jsonb), 'גרסת פתיחה', m.user_id)
    on conflict (agent_id, version_no) do nothing;
    n := n + 1;
  end loop;
  perform office.audit(m.org_id,'user',m.user_id::text,'seed_agents','agent_definitions',null,null,jsonb_build_object('count',n));
  return jsonb_build_object('seeded', n);
end $$;
revoke execute on function public.office_seed_agents(jsonb) from anon, public;
grant execute on function public.office_seed_agents(jsonb) to authenticated;

-- owner-only: seed the clearly-marked demo/test environment (fictional data, no real numbers)
create or replace function public.office_seed_test_data() returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare m office.memberships; c1 uuid; c2 uuid; l1 uuid; p1 uuid; pv uuid; e1 uuid; pr uuid;
begin
  m := office.ctx();
  if m.role <> 'owner' then raise exception 'owner_only'; end if;
  if exists(select 1 from office.clients where org_id = m.org_id and is_test) then return jsonb_build_object('already_seeded', true); end if;
  insert into office.clients(org_id, name, industry, department, status, is_test, profile) values
    (m.org_id, '[בדיקה] יזמות הדר', 'נדל״ן', 'pixel_nadlan', 'active', true, '{"goals":"מכירת דירות בשני פרויקטים","voice":"פרימיום, עובדתי"}') returning id into c1;
  insert into office.projects(org_id, client_id, name, kind, is_test, details) values
    (m.org_id, c1, '[בדיקה] פרויקט אלון', 'real_estate_project', true, '{"floors":"נתון לדוגמה — לא אמיתי"}'),
    (m.org_id, c1, '[בדיקה] פרויקט ברוש', 'real_estate_project', true, '{}');
  insert into office.clients(org_id, name, industry, department, status, is_test, profile) values
    (m.org_id, '[בדיקה] קליניקת שירותים', 'שירותים', 'pixel_digital', 'active', true, '{"goals":"לידים לטיפולים"}') returning id into c2;
  insert into office.clients(org_id, name, industry, status, is_test, profile) values (m.org_id, '[בדיקה] לקוח ממתין לחומרים', 'מסחר', 'onboarding', true, '{"missing":"לוגו, גישות"}');
  insert into office.contacts(org_id, client_id, name, phone_e164, phone_verified, is_test) values (m.org_id, c2, '[בדיקה] איש קשר', '+972500000001', true, true);
  insert into office.leads(org_id, company, contact_name, need, requested_services, client_budget, stage, is_test, dedupe_key, created_by)
    values (m.org_id, '[בדיקה] ליד עם מחיר נעול', 'בודק', 'ניהול סושיאל', '{social}', 5000, 'scoping', true, 'test-lead-locked', m.user_id) returning id into l1;
  insert into office.proposals(org_id, lead_id, title, status) values (m.org_id, l1, '[בדיקה] הצעת סושיאל', 'drafting') returning id into pr;
  perform set_config('office.price_write','owner',true);
  update office.proposals set locked_setup = 2500, locked_monthly = 4200, locked_media_budget = 3000, price_locked_by = m.user_id, price_locked_at = now() where id = pr;
  perform set_config('office.price_write','',true);
  -- active engagement with an 8 posts + 2 videos test package (no proposal link)
  insert into office.engagements(org_id, client_id, status, start_date, monthly_fee, confirmed_by, confirmed_at) values (m.org_id, c2, 'active', current_date, 0, m.user_id, now()) returning id into e1;
  insert into office.service_entitlements(org_id, engagement_id, service_key, title, unit, quantity_per_period) values
    (m.org_id, e1, 'social_post', 'פוסט סושיאל', 'post', 8), (m.org_id, e1, 'reel_video', 'סרטון קצר', 'video', 2);
  perform office.audit(m.org_id,'user',m.user_id::text,'seed_test_data','organization',m.org_id::text,null,null);
  return jsonb_build_object('ok', true, 'clients', 3);
end $$;
revoke execute on function public.office_seed_test_data() from anon, public;
grant execute on function public.office_seed_test_data() to authenticated;
