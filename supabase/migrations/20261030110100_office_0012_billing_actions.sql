create or replace function office.act_billing(m office.memberships, p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_client uuid; v_contact uuid; v_plan uuid; pl jsonb; ct jsonb; old jsonb; pay office.payments; n int;
begin
  case p_action
  when 'onboard_client', 'add_billing_plan' then
    pl := coalesce(p->'plan', '{}'::jsonb);
    if p_action = 'onboard_client' then
      if coalesce(trim(p->>'name'),'') = '' then raise exception 'missing:name'; end if;
      insert into office.clients(org_id, name, legal_name, industry, department, status, profile, created_by)
      values (m.org_id, trim(p->>'name'), nullif(p->>'legal_name',''), nullif(p->>'industry',''), coalesce(nullif(p->>'department',''),'pixel_digital'), 'active',
              jsonb_build_object('client_type', pl->>'kind', 'services', coalesce(pl->'services','[]'::jsonb)), m.user_id)
      returning id into v_client;
      ct := coalesce(p->'contact', '{}'::jsonb);
      if coalesce(trim(ct->>'name'),'') <> '' then
        insert into office.contacts(org_id, client_id, name, role_title, phone_e164, email)
        values (m.org_id, v_client, trim(ct->>'name'), nullif(ct->>'role_title',''), nullif(ct->>'phone',''), nullif(ct->>'email',''))
        returning id into v_contact;
      end if;
    else
      v_client := (p->>'client_id')::uuid;
      if not exists(select 1 from office.clients where id = v_client and org_id = m.org_id) then raise exception 'not_found:client'; end if;
      v_contact := nullif(p->>'contact_id','')::uuid;
      if v_contact is null then select id into v_contact from office.contacts where client_id = v_client and archived_at is null order by created_at limit 1; end if;
    end if;
    if pl->>'kind' not in ('retainer','one_time') then raise exception 'missing:billing_kind'; end if;
    if (pl->>'amount') is null or (pl->>'amount')::numeric <= 0 then raise exception 'missing:amount'; end if;
    if pl->>'vat_mode' not in ('included','plus_vat','exempt') then raise exception 'missing:vat_mode'; end if;
    if pl->>'kind' = 'retainer' and nullif(pl->>'payment_day','') is null then raise exception 'missing:payment_day'; end if;
    insert into office.billing_plans(org_id, client_id, contact_id, kind, services, title, amount, vat_mode, terms_template_id, payment_day, installments, start_date, end_date, notes, created_by)
    values (m.org_id, v_client, v_contact, pl->>'kind',
            coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(pl->'services','[]'::jsonb)) x), '{}'),
            coalesce(nullif(pl->>'title',''), case pl->>'kind' when 'retainer' then 'ריטיינר חודשי' else 'פרויקט חד-פעמי' end),
            (pl->>'amount')::numeric, pl->>'vat_mode', nullif(pl->>'terms_template_id','')::uuid,
            nullif(pl->>'payment_day','')::int, coalesce(nullif(pl->>'installments','')::int, 1),
            coalesce(nullif(pl->>'start_date','')::date, current_date), nullif(pl->>'end_date','')::date, nullif(pl->>'notes',''), m.user_id)
    returning id into v_plan;
    n := office.billing_generate(v_plan);
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'billing_plan',v_plan::text,null,p);
    return jsonb_build_object('id', v_client, 'client_id', v_client, 'plan_id', v_plan, 'payments_created', n);

  when 'update_billing_plan' then
    v_plan := (p->>'id')::uuid;
    select to_jsonb(b) into old from office.billing_plans b where id = v_plan and org_id = m.org_id;
    if old is null then raise exception 'not_found:billing_plan'; end if;
    if (p ? 'version') and (old->>'version')::int <> (p->>'version')::int then raise exception 'conflict:plan_changed_by_someone_else'; end if;
    update office.billing_plans set
      status = coalesce(nullif(p->>'status',''), status),
      amount = coalesce(nullif(p->>'amount','')::numeric, amount),
      vat_mode = coalesce(nullif(p->>'vat_mode',''), vat_mode),
      payment_day = coalesce(nullif(p->>'payment_day','')::int, payment_day),
      end_date = case when p ? 'end_date' then nullif(p->>'end_date','')::date else end_date end,
      notes = case when p ? 'notes' then nullif(p->>'notes','') else notes end,
      version = version + 1, updated_at = now()
    where id = v_plan;
    -- amount / VAT changes apply only to future unpaid rows that have no link or invoice yet
    if p ? 'amount' or p ? 'vat_mode' then
      update office.payments x set amount = b.amount, vat_mode = b.vat_mode, amount_gross = office.billing_gross(b.amount, b.vat_mode, b.terms_template_id), version = x.version + 1, updated_at = now()
      from office.billing_plans b where b.id = v_plan and x.plan_id = v_plan and x.status = 'scheduled' and x.due_date >= current_date and b.kind = 'retainer';
    end if;
    if p->>'status' in ('paused','ended') then
      update office.payments set status = 'cancelled', notes = coalesce(notes || ' · ', '') || 'בוטל עם ' || case p->>'status' when 'paused' then 'השהיית' else 'סיום' end || ' ההסדר', updated_by = m.user_id, updated_at = now()
      where plan_id = v_plan and status = 'scheduled' and due_date > current_date;
    end if;
    n := office.billing_generate(v_plan);
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'billing_plan',v_plan::text,old,p);
    return jsonb_build_object('id', v_plan, 'payments_created', n);

  when 'payment_mark_paid', 'payment_update', 'payment_record_link', 'payment_record_invoice' then
    select * into pay from office.payments where id = (p->>'id')::uuid and org_id = m.org_id for update;
    if pay.id is null then raise exception 'not_found:payment'; end if;
    if (p ? 'version') and pay.version <> (p->>'version')::int then raise exception 'conflict:payment_changed_by_someone_else'; end if;
    old := to_jsonb(pay);
    if p_action = 'payment_mark_paid' then
      update office.payments set paid_amount = coalesce(nullif(p->>'paid_amount','')::numeric, coalesce(amount_gross, amount)),
        paid_at = coalesce(nullif(p->>'paid_at','')::date, current_date), method = nullif(p->>'method',''),
        status = case when nullif(p->>'paid_amount','') is not null and (p->>'paid_amount')::numeric < coalesce(amount_gross, amount) then 'partial' else 'paid' end,
        notes = case when coalesce(p->>'notes','') <> '' then coalesce(notes || ' · ', '') || (p->>'notes') else notes end
      where id = pay.id;
    elsif p_action = 'payment_update' then
      if p->>'status' is not null and p->>'status' not in ('scheduled','waived','cancelled') then raise exception 'bad_status'; end if;
      update office.payments set status = coalesce(nullif(p->>'status',''), status), due_date = coalesce(nullif(p->>'due_date','')::date, due_date),
        notes = case when p ? 'notes' then nullif(p->>'notes','') else notes end,
        paid_amount = case when p->>'status' = 'scheduled' then null else paid_amount end, paid_at = case when p->>'status' = 'scheduled' then null else paid_at end
      where id = pay.id;
    elsif p_action = 'payment_record_link' then
      update office.payments set link_url = p->>'url', link_provider = p->>'provider', link_ref = p->>'ref', link_created_at = now(),
        status = case when status = 'scheduled' then 'link_created' else status end where id = pay.id;
    else
      update office.payments set invoice_provider = p->>'provider', invoice_doc_id = p->>'doc_id', invoice_number = p->>'number', invoice_url = p->>'url', invoice_created_at = now() where id = pay.id;
    end if;
    update office.payments set version = version + 1, updated_by = m.user_id, updated_at = now() where id = pay.id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'payment',pay.id::text,old,p);
    return jsonb_build_object('id', pay.id);
  else
    return '"__nohandle"'::jsonb;
  end case;
end $$;
revoke execute on function office.act_billing(office.memberships, text, jsonb) from public, anon, authenticated;

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
  if r = '"__nohandle"'::jsonb then raise exception 'unknown_action:%', p_action; end if;
  return r;
end $$;
revoke execute on function public.office_action(text, jsonb) from anon, public;
grant execute on function public.office_action(text, jsonb) to authenticated;

-- Worker: extend retainer schedules (cheap, idempotent)
create or replace function public.office_worker_billing_tick(p_secret text) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; b record; n int := 0;
begin
  v_org := office.worker_org(p_secret);
  for b in select id from office.billing_plans where org_id = v_org and status = 'active' and kind = 'retainer' loop
    n := n + office.billing_generate(b.id);
  end loop;
  return jsonb_build_object('payments_created', n);
end $$;
revoke execute on function public.office_worker_billing_tick(text) from public;
grant execute on function public.office_worker_billing_tick(text) to anon, authenticated;

-- Billing summary for the dashboard / payments page (owner/admin)
create or replace function public.office_billing_summary() returns jsonb
language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships; mstart date := date_trunc('month', current_date)::date; mend date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
begin
  m := office.ctx();
  if m.role not in ('owner','admin') then raise exception 'forbidden:billing' using errcode='42501'; end if;
  return (select jsonb_build_object(
    'month_expected', coalesce(sum(coalesce(amount_gross, amount)) filter (where due_date between mstart and mend and status not in ('waived','cancelled')),0),
    'month_collected', coalesce(sum(paid_amount) filter (where paid_at between mstart and mend),0),
    'overdue_count', count(*) filter (where is_overdue),
    'overdue_sum', coalesce(sum(coalesce(amount_gross, amount) - coalesce(paid_amount,0)) filter (where is_overdue),0),
    'due_7d_count', count(*) filter (where effective_status = 'due_soon'),
    'gross_unknown', count(*) filter (where amount_gross is null and status not in ('waived','cancelled','paid')),
    'active_retainers', (select count(*) from office.billing_plans where org_id = m.org_id and kind = 'retainer' and status = 'active'),
    'mrr', (select coalesce(sum(amount),0) from office.billing_plans where org_id = m.org_id and kind = 'retainer' and status = 'active'))
  from office.payments_v where org_id = m.org_id);
end $$;
revoke execute on function public.office_billing_summary() from anon, public;
grant execute on function public.office_billing_summary() to authenticated;
