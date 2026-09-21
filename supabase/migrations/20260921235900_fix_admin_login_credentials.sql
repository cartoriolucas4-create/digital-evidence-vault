-- Fix the production MCR admin credential without exposing the plaintext password.
-- The bcrypt hash was generated from the administrator-provided password.
create extension if not exists pgcrypto;

insert into public.mcr_admin_accounts (username, password_hash, active)
values (
  'jonathan.barros',
  '$2y$12$CHqQgK7MzoLIYkuqE5ftzeqRs/bewehQygNIrzm2tjlWu3gjgqu6O',
  true
)
on conflict (username) do update
set password_hash = excluded.password_hash,
    active = true;

create or replace function public.admin_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
  set row_security = off
as $
declare
  a public.mcr_admin_accounts;
  t text;
begin
  select * into a
  from public.mcr_admin_accounts
  where username = lower(trim(coalesce(p_username, '')))
    and active = true
  limit 1;

  if a.id is null or crypt(coalesce(p_password, ''), a.password_hash) <> a.password_hash then
    return jsonb_build_object('ok', false);
  end if;

  delete from public.mcr_admin_sessions where expires_at < now();

  t := encode(gen_random_bytes(32), 'hex');

  insert into public.mcr_admin_sessions(token, admin_id, expires_at)
  values (t, a.id, now() + interval '8 hours');

  return jsonb_build_object(
    'ok', true,
    'token', t,
    'expires_at', now() + interval '8 hours'
  );
end;
$$;

revoke all on function public.admin_login(text,text) from public;
grant execute on function public.admin_login(text,text) to anon, authenticated;
