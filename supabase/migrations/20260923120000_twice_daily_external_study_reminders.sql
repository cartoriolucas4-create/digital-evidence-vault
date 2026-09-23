-- Distinct external study reminders: at most two Web Push notifications per day.
-- 12:00 and 20:00 America/Sao_Paulo correspond to 15:00 and 23:00 UTC.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('mcr-daily-push-reminders');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.unschedule('mcr-midday-study-reminder');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.unschedule('mcr-evening-study-reminder');
exception when others then
  null;
end $$;

select cron.schedule(
  'mcr-midday-study-reminder',
  '0 15 * * *',
  $job$
    select net.http_post(
      url := 'https://krulxfcxalaxosebmiyh.supabase.co/functions/v1/mcr-push-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-mcr-cron-secret', (select cron_secret from public.mcr_push_config where id = true)
      ),
      body := '{"source":"supabase-cron","slot":"midday"}'::jsonb
    );
  $job$
);

select cron.schedule(
  'mcr-evening-study-reminder',
  '0 23 * * *',
  $job$
    select net.http_post(
      url := 'https://krulxfcxalaxosebmiyh.supabase.co/functions/v1/mcr-push-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-mcr-cron-secret', (select cron_secret from public.mcr_push_config where id = true)
      ),
      body := '{"source":"supabase-cron","slot":"evening"}'::jsonb
    );
  $job$
);
