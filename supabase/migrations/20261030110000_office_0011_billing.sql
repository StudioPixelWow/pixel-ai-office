-- Billing: client billing plans (retainer / one-time) and a payment schedule for office-manager control.
-- Rules: amounts are entered by a human (owner/admin) and never inferred; VAT mode is explicit per plan; a gross amount is
-- computed only from an owner-approved terms template with a vat_rate — otherwise it stays null (no guessing).

create table if not exists office.billing_plans (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references office.organizations(id),
  client_id uuid not null references office.clients(id), contact_id uuid references office.contacts(id),
  kind text not null check (kind in ('retainer','one_time')),
  services text[] not null default '{}', title text not null,
  amount numeric(12,2) not null check (amount > 0),
  vat_mode text not null check (vat_mode in ('included','plus_vat','exempt')),
  terms_template_id uuid references office.terms_templates(id), currency text not null default 'ILS',
  payment_day int check (payment_day between 1 and 28),
  installments int not null default 1 check (installments between 1 and 36),
  start_date date not null default current_date, end_date date,
  status text not null default 'active' check (status in ('active','paused','ended')),
  notes text, version int not null default 1, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (kind <> 'retainer' or payment_day is not null)
);
create index if not exists billing_plans_client_idx on office.billing_plans(client_id);

create table if not exists office.payments (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references office.organizations(id),
  client_id uuid not null references office.clients(id), plan_id uuid not null references office.billing_plans(id),
  seq int not null, period_month date, due_date date not null,
  amount numeric(12,2) not null, vat_mode text not null, amount_gross numeric(12,2),
  status text not null default 'scheduled' check (status in ('scheduled','link_created','partial','paid','waived','cancelled')),
  paid_amount numeric(12,2), paid_at date, method text check (method in ('credit','bit','transfer','check','cash','other')),
  link_url text, link_provider text, link_ref text, link_created_at timestamptz,
  invoice_provider text, invoice_doc_id text, invoice_number text, invoice_url text, invoice_created_at timestamptz,
  notes text, updated_by uuid, version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (plan_id, seq)
);
create index if not exists payments_due_idx on office.payments(due_date);
revoke all on office.billing_plans, office.payments from public, anon, authenticated;

create or replace function office.billing_gross(p_amount numeric, p_vat_mode text, p_template uuid) returns numeric
language sql stable security definer set search_path = office, public as $$
  select case p_vat_mode
    when 'included' then p_amount
    when 'exempt' then p_amount
    else (select round(p_amount * (1 + t.vat_rate / 100), 2) from office.terms_templates t where t.id = p_template and t.vat_rate is not null and t.approved_by_owner_at is not null)
  end
$$;

-- Idempotent schedule generation: retainers get monthly rows up to 2 months ahead (bounded by end_date); one-time plans
-- get their installments once. Existing rows are never rewritten.
create or replace function office.billing_generate(p_plan uuid) returns int
language plpgsql security definer set search_path = office, public as $$
declare b office.billing_plans; n int := 0; i int; m date; d date; horizon date; per numeric(12,2); g numeric(12,2);
begin
  select * into b from office.billing_plans where id = p_plan;
  if b.id is null or b.status <> 'active' then return 0; end if;
  if b.kind = 'retainer' then
    horizon := (date_trunc('month', current_date) + interval '2 month')::date;
    if b.end_date is not null and b.end_date < horizon then horizon := b.end_date; end if;
    i := 0; m := date_trunc('month', b.start_date)::date;
    while m <= horizon loop
      d := make_date(extract(year from m)::int, extract(month from m)::int, b.payment_day);
      -- first month: if the payment day already passed before the start date, the first charge is due on the start date
      insert into office.payments(org_id, client_id, plan_id, seq, period_month, due_date, amount, vat_mode, amount_gross)
      values (b.org_id, b.client_id, b.id, i, m, greatest(d, b.start_date), b.amount, b.vat_mode, office.billing_gross(b.amount, b.vat_mode, b.terms_template_id))
      on conflict (plan_id, seq) do nothing;
      if found then n := n + 1; end if;
      i := i + 1; m := (m + interval '1 month')::date;
    end loop;
  else
    per := round(b.amount / b.installments, 2);
    for i in 0 .. b.installments - 1 loop
      -- last installment absorbs rounding so the total equals the agreed amount exactly
      g := case when i = b.installments - 1 then b.amount - per * (b.installments - 1) else per end;
      insert into office.payments(org_id, client_id, plan_id, seq, due_date, amount, vat_mode, amount_gross)
      values (b.org_id, b.client_id, b.id, i, (b.start_date + make_interval(months => i))::date, g, b.vat_mode, office.billing_gross(g, b.vat_mode, b.terms_template_id))
      on conflict (plan_id, seq) do nothing;
      if found then n := n + 1; end if;
    end loop;
  end if;
  return n;
end $$;

create or replace view office.payments_v as
  select p.*, c.name as client_name, b.kind as plan_kind, b.title as plan_title, b.services,
         ct.name as contact_name, ct.phone_e164 as contact_phone, ct.email as contact_email,
         case when p.status in ('scheduled','link_created','partial') and p.due_date < current_date then 'overdue'
              when p.status in ('scheduled','link_created') and p.due_date <= current_date + 7 then 'due_soon'
              else p.status end as effective_status,
         (p.due_date < current_date and p.status in ('scheduled','link_created','partial')) as is_overdue
  from office.payments p join office.clients c on c.id = p.client_id join office.billing_plans b on b.id = p.plan_id
  left join office.contacts ct on ct.id = b.contact_id;
create or replace view office.billing_plans_v as
  select b.*, c.name as client_name, ct.name as contact_name, ct.phone_e164 as contact_phone, ct.email as contact_email,
         (select min(due_date) from office.payments p where p.plan_id = b.id and p.status in ('scheduled','link_created','partial')) as next_due
  from office.billing_plans b join office.clients c on c.id = b.client_id left join office.contacts ct on ct.id = b.contact_id;
revoke all on office.payments_v, office.billing_plans_v from public, anon, authenticated;

-- Financial data: owner/admin only (client_col null => office_list denies every other role)
insert into office.read_entities(entity, table_name, client_col, project_col, admin_only, hidden_cols, default_order) values
  ('payments','payments_v',null,null,true,'{}','due_date asc'),
  ('billing_plans','billing_plans_v',null,null,true,'{}','created_at desc')
on conflict (entity) do update set table_name = excluded.table_name, client_col = null, admin_only = true, default_order = excluded.default_order;

insert into office.action_permissions(action, roles, description) values
  ('onboard_client','{owner,admin}','הוספת לקוח עם איש קשר, שירותים ותנאי תשלום'),
  ('add_billing_plan','{owner,admin}','הוספת הסדר תשלום ללקוח'),
  ('update_billing_plan','{owner,admin}','עדכון/השהיה/סיום הסדר תשלום'),
  ('payment_mark_paid','{owner,admin}','סימון תשלום כשולם'),
  ('payment_update','{owner,admin}','עדכון תשלום (מועד, הערה, ויתור, ביטול)'),
  ('payment_record_link','{owner,admin}','שמירת קישור תשלום שנוצר'),
  ('payment_record_invoice','{owner,admin}','שמירת חשבונית שהופקה')
on conflict (action) do update set roles = excluded.roles, description = excluded.description;
