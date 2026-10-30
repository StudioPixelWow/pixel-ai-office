-- applied migration: office_0003c_act_crm (version 20261030072600)
create or replace function office.act_crm(m office.memberships, p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path = office, public, extensions as $$
declare r jsonb := '{}'::jsonb; v_id uuid; v_client uuid; v_text text; v_n int; v_old jsonb; v_wf uuid;
  pr office.proposals; pv office.proposal_versions; en office.engagements; sp office.service_periods;
begin
  case p_action
  when 'create_client' then
    insert into office.clients(org_id, name, legal_name, industry, department, status, profile, is_test, created_by, import_source)
    values (m.org_id, p->>'name', p->>'legal_name', p->>'industry', coalesce(p->>'department','pixel_digital'), coalesce(p->>'status','onboarding'),
            coalesce(p->'profile','{}'::jsonb), coalesce((p->>'is_test')::boolean,false), m.user_id, p->>'import_source') returning id into v_id;
    if m.role = 'account_manager' then insert into office.client_access(org_id,user_id,client_id) values (m.org_id, m.user_id, v_id); end if;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'client',v_id::text,null,p);
    r := jsonb_build_object('id', v_id);
  when 'update_client' then
    v_id := (p->>'id')::uuid;
    if not office.can_client(m, v_id) then raise exception 'forbidden:client'; end if;
    select to_jsonb(c) into v_old from office.clients c where id = v_id;
    if (p ? 'version') and (v_old->>'version')::int <> (p->>'version')::int then raise exception 'conflict:client_changed_by_someone_else'; end if;
    update office.clients set name = coalesce(p->>'name', name), industry = coalesce(p->>'industry', industry), department = coalesce(p->>'department', department),
      status = coalesce(p->>'status', status), profile = case when p ? 'profile' then profile || (p->'profile') else profile end,
      archived_at = case when (p->>'archive')::boolean then now() else archived_at end, version = version + 1, updated_at = now() where id = v_id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'client',v_id::text,v_old,p);
    r := jsonb_build_object('id', v_id);
  when 'create_contact' then
    v_client := (p->>'client_id')::uuid;
    if v_client is not null and not office.can_client(m, v_client) then raise exception 'forbidden:client'; end if;
    if nullif(p->>'phone_e164','') is not null and (p->>'phone_e164') !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'bad_phone_format_e164'; end if;
    insert into office.contacts(org_id, client_id, lead_id, name, role_title, phone_e164, email, approval_role, whatsapp_opt_in, is_test)
    values (m.org_id, v_client, (p->>'lead_id')::uuid, p->>'name', p->>'role_title', nullif(p->>'phone_e164',''), p->>'email', p->>'approval_role',
            coalesce((p->>'whatsapp_opt_in')::boolean,false), coalesce((p->>'is_test')::boolean,false)) returning id into v_id;
    r := jsonb_build_object('id', v_id);
  when 'verify_contact_phone' then
    update office.contacts set phone_verified = true, updated_at = now() where id = (p->>'id')::uuid and org_id = m.org_id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'contact',p->>'id',null,null);
  when 'create_project' then
    v_client := (p->>'client_id')::uuid;
    if not office.can_client(m, v_client) then raise exception 'forbidden:client'; end if;
    insert into office.projects(org_id, client_id, name, kind, site_url, details, is_test)
    values (m.org_id, v_client, p->>'name', coalesce(p->>'kind','project'), p->>'site_url', coalesce(p->'details','{}'::jsonb), coalesce((p->>'is_test')::boolean,false)) returning id into v_id;
    r := jsonb_build_object('id', v_id);
  when 'create_asset' then
    v_client := (p->>'client_id')::uuid;
    if not office.can_client(m, v_client) then raise exception 'forbidden:client'; end if;
    insert into office.client_assets(org_id, client_id, project_id, kind, identifier, owner_label, notes)
    values (m.org_id, v_client, (p->>'project_id')::uuid, p->>'kind', p->>'identifier', p->>'owner_label', p->>'notes')
    on conflict (client_id, kind, identifier) do update set notes = excluded.notes returning id into v_id;
    r := jsonb_build_object('id', v_id, 'note', 'הנכס נרשם. רישום אינו מעניק הרשאת עריכה — יש לחבר חיבור מאומת במסך החיבורים.');
  when 'create_lead' then
    v_text := lower(coalesce(nullif(p->>'contact_phone_e164',''), nullif(p->>'contact_email',''), p->>'company'));
    select id into v_id from office.leads where org_id = m.org_id and dedupe_key = v_text and archived_at is null;
    if v_id is not null then return jsonb_build_object('id', v_id, 'duplicate', true); end if;
    insert into office.leads(org_id, source, company, contact_name, contact_phone_e164, contact_email, need, goals, requested_services,
      current_state, required_state, materials, urgency, client_budget, client_budget_note, dedupe_key, is_test, created_by)
    values (m.org_id, coalesce(p->>'source','manual'), p->>'company', p->>'contact_name', nullif(p->>'contact_phone_e164',''), nullif(p->>'contact_email',''),
      p->>'need', p->>'goals', coalesce(array(select jsonb_array_elements_text(coalesce(p->'requested_services','[]'))),'{}'),
      p->>'current_state', p->>'required_state', p->>'materials', p->>'urgency', nullif(p->>'client_budget','')::numeric, p->>'client_budget_note',
      v_text, coalesce((p->>'is_test')::boolean,false), m.user_id) returning id into v_id;
    if nullif(p->>'brief','') is not null then insert into office.briefs(org_id, lead_id, content, created_by) values (m.org_id, v_id, jsonb_build_object('text', p->>'brief'), m.user_id); end if;
    if nullif(p->>'contact_name','') is not null then
      insert into office.contacts(org_id, lead_id, name, phone_e164, email, is_test)
      values (m.org_id, v_id, p->>'contact_name', case when (p->>'contact_phone_e164') ~ '^\+[1-9][0-9]{7,14}$' then p->>'contact_phone_e164' end, nullif(p->>'contact_email',''), coalesce((p->>'is_test')::boolean,false));
    end if;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'lead',v_id::text,null,p);
    perform office.emit(m.org_id,'lead.created','ליד חדש: '||(p->>'company'),null,null,null,null,null,jsonb_build_object('lead_id',v_id));
    perform office.fire_event(m.org_id, 'lead.created', null, v_id::text, 'ליד חדש: '||(p->>'company'));
    r := jsonb_build_object('id', v_id);
  when 'update_lead' then
    v_id := (p->>'id')::uuid;
    select to_jsonb(l) into v_old from office.leads l where id = v_id and org_id = m.org_id;
    if v_old is null then raise exception 'not_found'; end if;
    if (p ? 'version') and (v_old->>'version')::int <> (p->>'version')::int then raise exception 'conflict:lead_changed'; end if;
    update office.leads set need = coalesce(p->>'need',need), goals = coalesce(p->>'goals',goals), urgency = coalesce(p->>'urgency',urgency),
      stage = coalesce((p->>'stage')::office.lead_stage, stage), materials = coalesce(p->>'materials', materials),
      client_budget = case when p ? 'client_budget' then nullif(p->>'client_budget','')::numeric else client_budget end,
      requested_services = case when p ? 'requested_services' then array(select jsonb_array_elements_text(p->'requested_services')) else requested_services end,
      archived_at = case when (p->>'archive')::boolean then now() else archived_at end, version = version + 1, updated_at = now() where id = v_id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'lead',v_id::text,v_old,p);
  when 'update_brief' then
    select coalesce(max(version_no),0)+1 into v_n from office.briefs where coalesce(lead_id::text,'') = coalesce(p->>'lead_id','') and coalesce(client_id::text,'') = coalesce(p->>'client_id','');
    insert into office.briefs(org_id, lead_id, client_id, project_id, version_no, content, created_by)
    values (m.org_id, (p->>'lead_id')::uuid, (p->>'client_id')::uuid, (p->>'project_id')::uuid, v_n, coalesce(p->'content','{}'::jsonb), m.user_id) returning id into v_id;
    r := jsonb_build_object('id', v_id, 'version_no', v_n);
  when 'set_terms_template' then
    insert into office.terms_templates(org_id, name, currency, vat_rate, prices_include_vat, payment_terms, validity_days, approved_by_owner_at)
    values (m.org_id, p->>'name', coalesce(p->>'currency','ILS'), nullif(p->>'vat_rate','')::numeric, (p->>'prices_include_vat')::boolean, p->>'payment_terms', nullif(p->>'validity_days','')::int, now()) returning id into v_id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'terms_template',v_id::text,null,p);
    r := jsonb_build_object('id', v_id);
  when 'create_proposal' then
    insert into office.proposals(org_id, lead_id, client_id, title, currency, terms_template_id)
    values (m.org_id, (p->>'lead_id')::uuid, (p->>'client_id')::uuid, p->>'title', coalesce(p->>'currency','ILS'), nullif(p->>'terms_template_id','')::uuid) returning id into v_id;
    update office.leads set stage = 'proposal_drafting', updated_at = now() where id = (p->>'lead_id')::uuid and stage in ('new','scoping');
    r := jsonb_build_object('id', v_id);
  when 'set_price' then
    select * into pr from office.proposals where id = (p->>'proposal_id')::uuid and org_id = m.org_id for update;
    if pr.id is null then raise exception 'not_found'; end if;
    perform set_config('office.price_write', 'owner', true);
    update office.proposals set locked_setup = nullif(p->>'setup','')::numeric, locked_monthly = nullif(p->>'monthly','')::numeric,
      locked_media_budget = nullif(p->>'media_budget','')::numeric, locked_total_note = p->>'note',
      terms_template_id = coalesce(nullif(p->>'terms_template_id','')::uuid, terms_template_id),
      price_locked_by = m.user_id, price_locked_at = now(), updated_at = now(), version = version + 1 where id = pr.id;
    perform set_config('office.price_write', '', true);
    insert into office.proposal_price_history(proposal_id, setup, monthly, media, changed_by, reason)
    values (pr.id, nullif(p->>'setup','')::numeric, nullif(p->>'monthly','')::numeric, nullif(p->>'media_budget','')::numeric, m.user_id, p->>'reason');
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'proposal',pr.id::text, jsonb_build_object('setup',pr.locked_setup,'monthly',pr.locked_monthly,'media',pr.locked_media_budget), p);
    select * into pr from office.proposals where id = pr.id;
    r := jsonb_build_object('id', pr.id, 'totals', office.proposal_totals(pr.locked_setup, pr.locked_monthly, pr.locked_media_budget, pr.terms_template_id));
  when 'create_proposal_version' then
    select * into pr from office.proposals where id = (p->>'proposal_id')::uuid and org_id = m.org_id for update;
    if pr.price_locked_at is null then raise exception 'price_not_set_by_owner'; end if;
    update office.proposals set current_version = current_version + 1, updated_at = now() where id = pr.id returning current_version into v_n;
    update office.proposal_versions set review_status = 'superseded' where proposal_id = pr.id and review_status <> 'approved';
    insert into office.proposal_versions(proposal_id, version_no, content, price_snapshot, totals, change_summary, created_by)
    values (pr.id, v_n, coalesce(p->'content','{}'::jsonb), jsonb_build_object('setup',pr.locked_setup,'monthly',pr.locked_monthly,'media',pr.locked_media_budget,'locked_at',pr.price_locked_at),
      office.proposal_totals(pr.locked_setup, pr.locked_monthly, pr.locked_media_budget, pr.terms_template_id), p->>'change_summary', m.user_id) returning id into v_id;
    r := jsonb_build_object('id', v_id, 'version_no', v_n);
  when 'approve_proposal' then
    select * into pv from office.proposal_versions where id = (p->>'version_id')::uuid;
    select * into pr from office.proposals where id = pv.proposal_id and org_id = m.org_id for update;
    if pr.id is null then raise exception 'not_found'; end if;
    if pv.version_no <> pr.current_version then raise exception 'not_current_version'; end if;
    if (pv.price_snapshot->>'setup')::numeric is distinct from pr.locked_setup or (pv.price_snapshot->>'monthly')::numeric is distinct from pr.locked_monthly
       or (pv.price_snapshot->>'media')::numeric is distinct from pr.locked_media_budget then raise exception 'price_snapshot_differs_from_locked_price'; end if;
    update office.proposal_versions set review_status = 'approved', approved_by = m.user_id, approved_at = now() where id = pv.id;
    update office.proposals set status = 'ready_to_send', updated_at = now() where id = pr.id;
    update office.leads set stage = 'ready_to_send', updated_at = now() where id = pr.lead_id;
    update office.task_runs set status = 'done', stage = 'אושר', finished_at = now(), updated_at = now()
      where status = 'waiting_approval' and inputs->>'kind' = 'gate:proposal' and inputs->'params'->>'proposal_id' = pr.id::text;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'proposal_version',pv.id::text,null,null);
    perform office.emit(m.org_id,'proposal.approved','הצעה אושרה לשליחה: '||pr.title);
    r := jsonb_build_object('note','ההצעה אושרה לשליחה. זה אינו אישור התקשרות.');
  when 'mark_proposal_sent' then
    update office.proposals set status = 'sent', updated_at = now() where id = (p->>'proposal_id')::uuid and org_id = m.org_id and status = 'ready_to_send' returning * into pr;
    if pr.id is null then raise exception 'proposal_not_ready_to_send'; end if;
    update office.leads set stage = 'sent', updated_at = now() where id = pr.lead_id;
  when 'confirm_engagement' then
    select * into pv from office.proposal_versions where id = (p->>'version_id')::uuid and review_status = 'approved';
    if pv.id is null then raise exception 'version_not_approved'; end if;
    select * into pr from office.proposals where id = pv.proposal_id and org_id = m.org_id;
    v_client := pr.client_id;
    if v_client is null then
      insert into office.clients(org_id, name, status, profile, is_test, created_by)
      select m.org_id, l.company, 'onboarding', jsonb_build_object('need', l.need, 'goals', l.goals), l.is_test, m.user_id from office.leads l where l.id = pr.lead_id returning id into v_client;
      update office.proposals set client_id = v_client where id = pr.id;
      update office.contacts set client_id = v_client where lead_id = pr.lead_id and client_id is null;
    end if;
    insert into office.engagements(org_id, client_id, proposal_version_id, accepted_snapshot, status, start_conditions, start_date, setup_fee, monthly_fee, media_budget, confirmed_by, confirmed_at)
    values (m.org_id, v_client, pv.id, to_jsonb(pv) || jsonb_build_object('items', (select coalesce(jsonb_agg(to_jsonb(i)),'[]') from office.proposal_items i where i.proposal_version_id = pv.id)),
      'pending_start', coalesce(p->'start_conditions','["תשלום דמי הקמה","קבלת חומרים וגישות"]'::jsonb), nullif(p->>'start_date','')::date,
      (pv.price_snapshot->>'setup')::numeric, (pv.price_snapshot->>'monthly')::numeric, (pv.price_snapshot->>'media')::numeric, m.user_id, now())
    on conflict (proposal_version_id) do nothing returning id into v_id;
    if v_id is null then select id into v_id from office.engagements where proposal_version_id = pv.id; end if;
    insert into office.service_entitlements(org_id, engagement_id, service_key, title, unit, quantity_per_period, revision_rounds, included_deliverables)
    select m.org_id, v_id, e->>'service_key', e->>'title', e->>'unit', (e->>'quantity')::numeric, coalesce((e->>'revision_rounds')::int,2), e->>'included'
    from jsonb_array_elements(coalesce(p->'entitlements','[]'::jsonb)) e on conflict (engagement_id, service_key) do nothing;
    update office.proposals set status = 'accepted', updated_at = now() where id = pr.id;
    update office.leads set stage = 'engaged', client_id = v_client, updated_at = now() where id = pr.lead_id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'engagement',v_id::text,null,p);
    v_wf := office.instantiate_workflow(m.org_id, null, 'single_agent', v_client, null,
      jsonb_build_object('instruction','הכן צ׳קליסט חומרים וגישות, בריף פנימי, תוכנית הקמה וסדר יום לפגישת התנעה לפי ההצעה המאושרת. אל תתחיל עבודת קמפיינים/אתר לפני תנאי ההתחלה.','engagement_id',v_id),
      'onboard:'||v_id, null, 'account_manager', 'הקמת לקוח');
    r := jsonb_build_object('engagement_id', v_id, 'client_id', v_client);
  when 'add_entitlement' then
    insert into office.service_entitlements(org_id, engagement_id, service_key, title, unit, quantity_per_period, revision_rounds, included_deliverables)
    select m.org_id, e.id, p->>'service_key', p->>'title', p->>'unit', (p->>'quantity')::numeric, coalesce((p->>'revision_rounds')::int,2), p->>'included'
    from office.engagements e where e.id = (p->>'engagement_id')::uuid and e.org_id = m.org_id
    on conflict (engagement_id, service_key) do update set quantity_per_period = excluded.quantity_per_period, title = excluded.title returning id into v_id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'entitlement',v_id::text,null,p);
    r := jsonb_build_object('id', v_id);
  when 'activate_engagement' then
    update office.engagements set status = 'active', start_date = coalesce(nullif(p->>'start_date','')::date, start_date, current_date),
      rollover_policy = coalesce(p->>'rollover_policy', rollover_policy), partial_month_policy = coalesce(p->>'partial_month_policy', partial_month_policy), updated_at = now()
      where id = (p->>'engagement_id')::uuid and org_id = m.org_id and status in ('pending_start','paused') returning * into en;
    if en.id is null then raise exception 'engagement_not_found_or_not_pending'; end if;
    update office.clients set status = 'active', updated_at = now() where id = en.client_id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'engagement',en.id::text,null,p);
    perform office.emit(m.org_id,'engagement.activated','התקשרות הופעלה',null,null,null,null,en.client_id);
    perform office.fire_event(m.org_id, 'engagement.activated', en.client_id, en.id::text, 'התקשרות הופעלה');
  when 'open_service_period' then
    select * into en from office.engagements where id = (p->>'engagement_id')::uuid and org_id = m.org_id and status = 'active';
    if en.id is null then raise exception 'engagement_not_active'; end if;
    insert into office.service_periods(org_id, engagement_id, client_id, period_start, period_end)
    values (m.org_id, en.id, en.client_id, date_trunc('month', (p->>'month')::date)::date, (date_trunc('month', (p->>'month')::date) + interval '1 month - 1 day')::date)
    on conflict (engagement_id, period_start) do nothing returning * into sp;
    if sp.id is null then
      select * into sp from office.service_periods where engagement_id = en.id and period_start = date_trunc('month', (p->>'month')::date)::date;
      r := jsonb_build_object('id', sp.id, 'already_open', true);
    else r := jsonb_build_object('id', sp.id); end if;
  else
    return '"__nohandle"'::jsonb;
  end case;
  return r;
end $$;
insert into office.action_permissions(action, roles, description) values ('add_entitlement','{owner}','שירות/מכסה בהתקשרות') on conflict do nothing;
