-- Quick branded proposals from a lead + public share link with digital signature + optional payment link.
alter table office.leads add column if not exists industry text;
alter table office.proposals add column if not exists number text, add column if not exists payment_link_url text, add column if not exists payment_link_at timestamptz;

create table if not exists office.proposal_signatures (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references office.organizations(id),
  proposal_id uuid not null references office.proposals(id), version_id uuid not null references office.proposal_versions(id),
  signer_name text not null, signer_title text, signature_blob_id uuid, content_hash text not null,
  ip_hash text, user_agent text, signed_at timestamptz not null default now(), unique (proposal_id, version_id)
);
revoke all on office.proposal_signatures from public, anon, authenticated;
insert into office.read_entities(entity, table_name, client_col, project_col, admin_only, hidden_cols, default_order)
values ('proposal_signatures','proposal_signatures',null,null,true,'{}','signed_at desc') on conflict (entity) do nothing;

insert into office.action_permissions(action, roles, description) values
  ('quick_proposal','{owner}','הצעת מחיר ממותגת מליד (המחיר נקבע ע״י ה-Owner)'),
  ('create_share_link','{owner}','קישור ללקוח לצפייה וחתימה על הצעה מאושרת')
on conflict (action) do update set roles = excluded.roles, description = excluded.description;

create or replace function office.version_hash(v office.proposal_versions) returns text language sql immutable as $$
  select encode(extensions.digest(convert_to(coalesce(v.content::text,'') || '|' || coalesce(v.price_snapshot::text,'') || '|' || v.version_no::text, 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function office.act_proposals(m office.memberships, p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path = office, public, extensions as $$
declare l office.leads; pr office.proposals; v_id uuid; v_ver uuid; v_n int; it jsonb; v_tok text; pv office.proposal_versions; i int := 0;
begin
  case p_action
  when 'quick_proposal' then
    select * into l from office.leads where id = (p->>'lead_id')::uuid and org_id = m.org_id;
    if l.id is null then raise exception 'not_found:lead'; end if;
    if p->>'kind' not in ('retainer','one_time') then raise exception 'missing:billing_kind'; end if;
    if nullif(p->>'price','') is null or (p->>'price')::numeric <= 0 then raise exception 'missing:amount'; end if;
    if p->>'vat_mode' not in ('included','plus_vat','exempt') then raise exception 'missing:vat_mode'; end if;
    insert into office.proposals(org_id, lead_id, title, currency, terms_template_id, number, status)
    values (m.org_id, l.id, coalesce(nullif(p->>'title',''), 'הצעת מחיר — ' || l.company), 'ILS', nullif(p->>'terms_template_id','')::uuid,
            to_char(now() at time zone 'Asia/Jerusalem', 'YYYY-MMDD') || '-' || lpad(((select count(*) from office.proposals where org_id = m.org_id) + 1)::text, 3, '0'), 'drafting')
    returning * into pr;
    perform set_config('office.price_write', 'owner', true);
    update office.proposals set locked_setup = case when p->>'kind' = 'one_time' then (p->>'price')::numeric end,
      locked_monthly = case when p->>'kind' = 'retainer' then (p->>'price')::numeric end, locked_total_note = p->>'price_note',
      price_locked_by = m.user_id, price_locked_at = now(), current_version = 1, updated_at = now() where id = pr.id returning * into pr;
    perform set_config('office.price_write', '', true);
    insert into office.proposal_price_history(proposal_id, setup, monthly, media, changed_by, reason) values (pr.id, pr.locked_setup, pr.locked_monthly, null, m.user_id, 'יצירת הצעה');
    insert into office.proposal_versions(proposal_id, version_no, content, price_snapshot, totals, change_summary, created_by)
    values (pr.id, 1, coalesce(p->'content','{}'::jsonb) || jsonb_build_object('kind', p->>'kind', 'vat_mode', p->>'vat_mode', 'validity_days', coalesce(nullif(p->>'validity_days','')::int, 30),
              'client', jsonb_build_object('company', l.company, 'contact_name', l.contact_name, 'industry', l.industry, 'phone', l.contact_phone_e164, 'email', l.contact_email)),
            jsonb_build_object('setup', pr.locked_setup, 'monthly', pr.locked_monthly, 'media', null, 'locked_at', pr.price_locked_at),
            office.proposal_totals(pr.locked_setup, pr.locked_monthly, null, pr.terms_template_id), 'גרסה ראשונה', m.user_id) returning id into v_ver;
    for it in select * from jsonb_array_elements(coalesce(p->'addons','[]'::jsonb)) loop
      if coalesce(it->>'title','') <> '' and nullif(it->>'price','') is not null then
        insert into office.proposal_items(proposal_version_id, kind, title, description, quantity, unit_price, sort)
        values (v_ver, 'addon', it->>'title', it->>'description', 1, (it->>'price')::numeric, i); i := i + 1;
      end if;
    end loop;
    update office.leads set stage = 'pending_approval', updated_at = now() where id = l.id and stage in ('new','scoping','proposal_drafting');
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'proposal',pr.id::text,null,p);
    return jsonb_build_object('id', pr.id, 'version_id', v_ver);

  when 'create_share_link' then
    select * into pr from office.proposals where id = (p->>'proposal_id')::uuid and org_id = m.org_id for update;
    if pr.id is null then raise exception 'not_found'; end if;
    select * into pv from office.proposal_versions where proposal_id = pr.id and version_no = pr.current_version;
    if pv.review_status <> 'approved' then raise exception 'proposal_not_approved'; end if;
    v_tok := encode(gen_random_bytes(24), 'hex');
    update office.proposals set share_token_hash = encode(digest(v_tok, 'sha256'), 'hex'),
      share_expires_at = now() + make_interval(days => coalesce((pv.content->>'validity_days')::int, 30)), updated_at = now() where id = pr.id;
    perform office.audit(m.org_id,'user',m.user_id::text,p_action,'proposal',pr.id::text,null,null);
    return jsonb_build_object('token', v_tok, 'expires_at', now() + make_interval(days => coalesce((pv.content->>'validity_days')::int, 30)));
  else
    return '"__nohandle"'::jsonb;
  end case;
end $$;
revoke execute on function office.act_proposals(office.memberships, text, jsonb) from public, anon, authenticated;

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
  if r = '"__nohandle"'::jsonb then raise exception 'unknown_action:%', p_action; end if;
  return r;
end $$;
revoke execute on function public.office_action(text, jsonb) from anon, public;
grant execute on function public.office_action(text, jsonb) to authenticated;

-- Public (token) access: one proposal's approved current version only. Never lists or exposes anything else.
create or replace function office.proposal_by_token(p_token text) returns office.proposals
language sql stable security definer set search_path = office, public, extensions as $$
  select * from office.proposals where share_token_hash = encode(digest(coalesce(p_token,''), 'sha256'), 'hex') and share_expires_at > now() and archived_at is null limit 1
$$;

create or replace function public.office_public_proposal(p_token text) returns jsonb
language plpgsql stable security definer set search_path = office, public, extensions as $$
declare pr office.proposals; pv office.proposal_versions; s office.proposal_signatures;
begin
  pr := office.proposal_by_token(p_token);
  if pr.id is null then raise exception 'link_invalid_or_expired'; end if;
  select * into pv from office.proposal_versions where proposal_id = pr.id and version_no = pr.current_version and review_status = 'approved';
  if pv.id is null then raise exception 'link_invalid_or_expired'; end if;
  select * into s from office.proposal_signatures where proposal_id = pr.id and version_id = pv.id;
  return jsonb_build_object('title', pr.title, 'number', pr.number, 'created_at', pv.created_at, 'expires_at', pr.share_expires_at,
    'content', pv.content, 'price', pv.price_snapshot, 'totals', pv.totals, 'version_no', pv.version_no,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'description', i.description, 'price', i.unit_price) order by i.sort), '[]'::jsonb) from office.proposal_items i where i.proposal_version_id = pv.id and i.unit_price is not null),
    'signed', s.id is not null, 'signed_at', s.signed_at, 'signer_name', s.signer_name, 'payment_link_url', pr.payment_link_url);
end $$;

create or replace function public.office_public_sign(p_token text, p_name text, p_title text, p_sig_b64 text, p_ua text, p_ip text) returns jsonb
language plpgsql security definer set search_path = office, public, extensions as $$
declare pr office.proposals; pv office.proposal_versions; v_blob uuid;
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
  update office.proposals set status = 'accepted', updated_at = now() where id = pr.id;
  update office.leads set stage = 'engaged', updated_at = now() where id = pr.lead_id;
  perform office.audit(pr.org_id,'system','client_signing_link','proposal_signed','proposal',pr.id::text,null,jsonb_build_object('signer', trim(p_name), 'version', pv.version_no));
  perform office.emit(pr.org_id,'proposal.signed','ההצעה נחתמה: '||pr.title||' · '||trim(p_name));
  return jsonb_build_object('ok', true, 'signed_at', now());
end $$;

create or replace function public.office_public_payment_context(p_token text) returns jsonb
language plpgsql stable security definer set search_path = office, public, extensions as $$
declare pr office.proposals; pv office.proposal_versions; g numeric; base numeric;
begin
  pr := office.proposal_by_token(p_token);
  if pr.id is null then raise exception 'link_invalid_or_expired'; end if;
  select * into pv from office.proposal_versions where proposal_id = pr.id and version_no = pr.current_version and review_status = 'approved';
  if not exists(select 1 from office.proposal_signatures where proposal_id = pr.id and version_id = pv.id) then raise exception 'sign_first'; end if;
  base := coalesce((pv.price_snapshot->>'setup')::numeric, (pv.price_snapshot->>'monthly')::numeric);
  g := case pv.content->>'vat_mode' when 'plus_vat' then coalesce((pv.totals->>'setup_with_vat')::numeric, (pv.totals->>'monthly_with_vat')::numeric) else base end;
  return jsonb_build_object('id', pr.id, 'title', pr.title, 'company', pv.content->'client'->>'company', 'contact_name', pv.content->'client'->>'contact_name',
    'phone', pv.content->'client'->>'phone', 'email', pv.content->'client'->>'email', 'gross', g, 'kind', pv.content->>'kind', 'existing_link', pr.payment_link_url);
end $$;

create or replace function public.office_public_record_payment_link(p_token text, p_url text) returns void
language plpgsql security definer set search_path = office, public, extensions as $$
declare pr office.proposals;
begin
  pr := office.proposal_by_token(p_token);
  if pr.id is null then raise exception 'link_invalid_or_expired'; end if;
  if p_url !~ '^https://' then raise exception 'bad_url'; end if;
  update office.proposals set payment_link_url = p_url, payment_link_at = now() where id = pr.id and payment_link_url is null;
end $$;

revoke execute on function public.office_public_proposal(text), public.office_public_sign(text,text,text,text,text,text), public.office_public_payment_context(text), public.office_public_record_payment_link(text,text) from public;
grant execute on function public.office_public_proposal(text), public.office_public_sign(text,text,text,text,text,text), public.office_public_payment_context(text), public.office_public_record_payment_link(text,text) to anon, authenticated;

-- signed proposal info for the owner view
create or replace function public.office_proposal_signature(p_proposal uuid) returns jsonb
language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships;
begin
  m := office.ctx();
  if m.role not in ('owner','admin') then raise exception 'forbidden' using errcode='42501'; end if;
  return (select to_jsonb(s) - 'ip_hash' from office.proposal_signatures s where s.proposal_id = p_proposal and s.org_id = m.org_id order by signed_at desc limit 1);
end $$;
revoke execute on function public.office_proposal_signature(uuid) from anon, public;
grant execute on function public.office_proposal_signature(uuid) to authenticated;
