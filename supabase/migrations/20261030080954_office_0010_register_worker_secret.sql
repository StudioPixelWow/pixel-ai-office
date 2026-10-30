-- The worker secret is set by the Owner in Vercel (CRON_SECRET, never passes through chat/agents). The server hashes it
-- and the authenticated Owner registers only the hash from the setup checklist.
create or replace function public.office_register_worker_secret(p_sha256 text) returns jsonb
language plpgsql security definer set search_path = office, public as $$
declare m office.memberships;
begin
  m := office.ctx();
  if m.role <> 'owner' then raise exception 'owner_only'; end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'bad_hash'; end if;
  insert into office.system_secrets(name, sha256) values ('worker', p_sha256) on conflict (name) do update set sha256 = excluded.sha256, rotated_at = now();
  perform office.audit(m.org_id,'user',m.user_id::text,'register_worker_secret','system_secret','worker',null,null);
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.office_register_worker_secret(text) from anon, public;
grant execute on function public.office_register_worker_secret(text) to authenticated;

create or replace function public.office_worker_secret_status() returns jsonb language plpgsql stable security definer set search_path = office, public as $$
declare m office.memberships; begin m := office.ctx(); return (select jsonb_build_object('registered', count(*) > 0, 'rotated_at', max(rotated_at)) from office.system_secrets where name = 'worker'); end $$;
revoke execute on function public.office_worker_secret_status() from anon, public;
grant execute on function public.office_worker_secret_status() to authenticated;

delete from office.system_secrets where name = 'worker';
