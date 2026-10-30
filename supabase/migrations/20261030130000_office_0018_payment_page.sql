-- Server-only read of one payment for the branded payment page (worker secret required; never exposed to anon directly).
create or replace function public.office_worker_payment_context(p_secret text, p_payment uuid) returns jsonb
language plpgsql stable security definer set search_path = office, public as $$
declare v_org uuid; r record;
begin
  v_org := office.worker_org(p_secret);
  select * into r from office.payments_v where id = p_payment and org_id = v_org;
  if r.id is null then raise exception 'not_found'; end if;
  return jsonb_build_object('id', r.id, 'client_name', r.client_name, 'plan_title', r.plan_title, 'period_month', r.period_month, 'due_date', r.due_date,
    'gross', r.amount_gross, 'status', r.status, 'contact_name', r.contact_name, 'contact_phone', r.contact_phone, 'contact_email', r.contact_email, 'kind', r.plan_kind);
end $$;
revoke execute on function public.office_worker_payment_context(text,uuid) from public;
grant execute on function public.office_worker_payment_context(text,uuid) to anon, authenticated;
