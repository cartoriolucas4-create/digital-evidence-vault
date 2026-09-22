-- MCR Web Push: persistent multi-device subscriptions and daily reminders.
create table if not exists public.mcr_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mcr_push_subscriptions_user_id_idx
  on public.mcr_push_subscriptions(user_id);

alter table public.mcr_push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.mcr_push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.mcr_push_subscriptions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('mcr-daily-push-reminders');
exception when others then
  null;
end $$;

select cron.schedule(
  'mcr-daily-push-reminders',
  '0 22 * * *',
  $job$
    select net.http_post(
      url := 'https://krulxfcxalaxosebmiyh.supabase.co/functions/v1/mcr-push-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-mcr-cron-secret', '7IFYr5TicFRQ2Rpd8q8qiysiWEhpgPc4xs65IFBnK04'
      ),
      body := '{"source":"supabase-cron"}'::jsonb
    );
  $job$
);
