create extension if not exists pgcrypto;

create table if not exists public.mcr_admin_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mcr_admin_sessions (
  token text primary key,
  admin_id uuid not null references public.mcr_admin_accounts(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.mcr_admin_accounts enable row level security;
alter table public.mcr_admin_sessions enable row level security;
revoke all on public.mcr_admin_accounts from anon, authenticated;
revoke all on public.mcr_admin_sessions from anon, authenticated;

insert into public.mcr_admin_accounts (username, password_hash)
values ('jonathan.barros', '$2y$12$FQWfo.xdgef1A.ETiST8ku/oxwhnBO9X1SlSy0WkhHZaAm4euHtMm')
on conflict (username) do nothing;

create or replace function public.admin_login(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare a public.mcr_admin_accounts; t text;
begin
  select * into a from public.mcr_admin_accounts
  where username = lower(trim(p_username)) and active = true limit 1;
  if a.id is null or crypt(p_password, a.password_hash) <> a.password_hash then
    return jsonb_build_object('ok', false);
  end if;
  delete from public.mcr_admin_sessions where expires_at < now();
  t := encode(gen_random_bytes(32), 'hex');
  insert into public.mcr_admin_sessions(token, admin_id, expires_at)
  values(t, a.id, now() + interval '8 hours');
  return jsonb_build_object('ok', true, 'token', t, 'expires_at', now() + interval '8 hours');
end;
$$;

create or replace function public.admin_list_users(p_token text)
returns table(id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists(select 1 from public.mcr_admin_sessions s join public.mcr_admin_accounts a on a.id=s.admin_id where s.token=p_token and s.expires_at>now() and a.active) then
    return;
  end if;
  return query select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at from auth.users u order by u.created_at desc;
end;
$$;

create or replace function public.admin_logout(p_token text)
returns boolean
language sql
security definer
set search_path = public
as $$
  delete from public.mcr_admin_sessions where token=p_token returning true;
$$;

revoke all on function public.admin_login(text,text) from public;
revoke all on function public.admin_list_users(text) from public;
revoke all on function public.admin_logout(text) from public;
grant execute on function public.admin_login(text,text) to anon, authenticated;
grant execute on function public.admin_list_users(text) to anon, authenticated;
grant execute on function public.admin_logout(text) to anon, authenticated;


-- Secure read function used by the administrative dashboard.
create or replace function public.mcr_users_for_admin(p_key text)
returns table(
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  name text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'nome'
    ) as name
  from auth.users u
  where p_key = 'MCR-ADMIN-2026'
  order by u.created_at desc;
$$;

revoke all on function public.mcr_users_for_admin(text) from public;
grant execute on function public.mcr_users_for_admin(text) to anon, authenticated;
