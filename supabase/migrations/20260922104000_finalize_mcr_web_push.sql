-- Finalize MCR Web Push infrastructure with server-side VAPID configuration.
create table if not exists public.mcr_push_config (
  id boolean primary key default true check (id = true),
  public_key text,
  private_key text,
  cron_secret text not null default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now()
);

alter table public.mcr_push_config enable row level security;
revoke all on public.mcr_push_config from anon, authenticated;

insert into public.mcr_push_config (id)
values (true)
on conflict (id) do nothing;

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
        'x-mcr-cron-secret', (select cron_secret from public.mcr_push_config where id = true)
      ),
      body := '{"source":"supabase-cron"}'::jsonb
    );
  $job$
);
