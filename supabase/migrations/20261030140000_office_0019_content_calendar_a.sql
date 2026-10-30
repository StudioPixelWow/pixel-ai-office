-- Content Gantt: social post fields on content_items + calendar marker flags
alter table office.content_items
  add column if not exists idea text, add column if not exists post_text text, add column if not exists hashtags text[] not null default '{}',
  add column if not exists creative_prompt text, add column if not exists creative_blob_id uuid, add column if not exists slot_kind text not null default 'regular',
  add column if not exists marker_title text, add column if not exists rtm_item_id uuid, add column if not exists platforms text[] not null default '{}',
  add column if not exists social_status text not null default 'idea', add column if not exists published_url text, add column if not exists published_at timestamptz,
  add column if not exists plan_month date, add column if not exists generated_by text, add column if not exists hook text, add column if not exists cta text, add column if not exists pillar text;
do $$ begin
  alter table office.content_items add constraint content_items_social_status_chk check (social_status in ('idea','writing','design','pending_approval','approved','scheduled','published','not_published'));
exception when duplicate_object then null; end $$;
create index if not exists content_items_client_month on office.content_items(client_id, plan_month);
alter table office.calendar_markers add column if not exists no_marketing boolean not null default false, add column if not exists category text, add column if not exists hebrew text, add column if not exists memo text;

-- Upsert calendar markers (worker secret; markers come only from Hebcal or the curated marketing-days list)
create or replace function public.office_worker_upsert_markers(p_secret text, p_markers jsonb) returns int
language plpgsql security definer set search_path = office, public as $$
declare v_org uuid; it jsonb; n int := 0;
begin
  v_org := office.worker_org(p_secret);
  for it in select * from jsonb_array_elements(coalesce(p_markers,'[]')) loop
    insert into office.calendar_markers(org_id, date, title, kind, source, no_marketing, category, hebrew, memo)
    values (v_org, (it->>'date')::date, left(it->>'title',200), coalesce(it->>'kind','holiday'), left(coalesce(it->>'source','hebcal.com'),120), coalesce((it->>'no_marketing')::boolean,false), it->>'category', it->>'hebrew', left(it->>'memo',500))
    on conflict (org_id, date, title) do update set no_marketing = excluded.no_marketing, category = excluded.category, kind = excluded.kind, memo = coalesce(excluded.memo, office.calendar_markers.memo);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.office_worker_upsert_markers(text,jsonb) from public;
grant execute on function public.office_worker_upsert_markers(text,jsonb) to anon, authenticated;

-- Creative image for a content item (user-scoped; image bytes come from our own server route)
create or replace function public.office_content_set_creative(p_item uuid, p_mime text, p_b64 text, p_prompt text default null) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare m office.memberships; ci office.content_items; v_id uuid;
begin
  m := office.ctx();
  if m.role not in ('owner','admin','account_manager') then raise exception 'forbidden' using errcode='42501'; end if;
  select * into ci from office.content_items where id = p_item and org_id = m.org_id; if ci.id is null then raise exception 'not_found'; end if;
  if not office.can_client(m, ci.client_id) then raise exception 'forbidden:client'; end if;
  if p_mime not in ('image/png','image/jpeg','image/webp') then raise exception 'bad_mime'; end if;
  v_id := office.put_blob(m.org_id, ci.client_id, ci.project_id, null, 'creative', p_mime, p_b64, false);
  update office.content_items set creative_blob_id = v_id, creative_prompt = coalesce(p_prompt, creative_prompt),
    social_status = case when social_status in ('idea','writing','design') then 'design' else social_status end, updated_at = now(), version = version + 1 where id = ci.id;
  perform office.audit(m.org_id,'user',m.user_id::text,'content_set_creative','content_item',ci.id::text,null,jsonb_build_object('blob',v_id));
  return jsonb_build_object('blob_id', v_id);
end $$;
revoke execute on function public.office_content_set_creative(uuid,text,text,text) from public, anon;
grant execute on function public.office_content_set_creative(uuid,text,text,text) to authenticated;

insert into office.action_permissions(action, roles, description) values
 ('start_content_month','{owner,admin,account_manager}','יצירת גאנט תוכן חודשי'),
 ('update_content_item','{owner,admin,account_manager}','עריכת פריט בגאנט'),
 ('content_set_status','{owner,admin,account_manager}','שינוי סטטוס/אישור פוסטים'),
 ('content_mark_published','{owner,admin,account_manager}','סימון פוסט כפורסם')
on conflict (action) do update set roles = excluded.roles, description = excluded.description;
