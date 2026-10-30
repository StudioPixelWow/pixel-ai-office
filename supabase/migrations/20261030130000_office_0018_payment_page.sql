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

-- Team-added content samples (pasted links, enriched server-side) → asset bank + dossier_extra.samples for voice calibration
create or replace function public.office_add_samples(p_client uuid, p_samples jsonb) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare m office.memberships; c office.clients; it jsonb; n int := 0; cur jsonb; merged jsonb;
begin
  m := office.ctx();
  if m.role not in ('owner','admin','manager') then raise exception 'forbidden' using errcode='42501'; end if;
  select * into c from office.clients where id = p_client and org_id = m.org_id; if c.id is null then raise exception 'not_found'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_samples,'[]')) loop
    if coalesce(it->>'url','') !~ '^https://' then continue; end if;
    insert into office.client_assets(org_id, client_id, kind, identifier, owner_label, access_status, notes)
    values (m.org_id, c.id, 'social_sample', it->>'url', it->>'network', 'public', left(concat_ws(' · ', it->>'type', case when it->>'views' is not null then (it->>'views')||' צפיות' end, left(coalesce(it->>'text',''),300)),600))
    on conflict (client_id, kind, identifier) do update set notes = excluded.notes, updated_at = now();
    n := n + 1;
  end loop;
  cur := coalesce(c.profile->'dossier_extra'->'samples','[]');
  select coalesce(jsonb_agg(v order by ord),'[]') into merged from (
    select distinct on (v->>'url') v, ord from (
      select v, row_number() over () ord from jsonb_array_elements(coalesce(p_samples,'[]') || cur) v where coalesce(v->>'url','') ~ '^https://') a
    order by v->>'url', ord) b;
  update office.clients set profile = jsonb_set(coalesce(profile,'{}'), '{dossier_extra}', coalesce(profile->'dossier_extra','{}') || jsonb_build_object('samples', merged)), updated_at = now() where id = c.id;
  perform office.emit(m.org_id, 'client.samples_added', n || ' דוגמאות תוכן נוספו לבנק הנכסים', null, null, null, null, c.id);
  return jsonb_build_object('added', n, 'total', jsonb_array_length(merged));
end $$;
revoke execute on function public.office_add_samples(uuid,jsonb) from public, anon;
grant execute on function public.office_add_samples(uuid,jsonb) to authenticated;
