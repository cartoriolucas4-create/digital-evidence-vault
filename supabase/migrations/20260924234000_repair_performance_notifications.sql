-- Repair migration: ensure intelligent performance notifications exist.
-- The application intentionally tolerates an older database, but without this table
-- performance observations can never be generated or loaded.
create table if not exists public.study_performance_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid null references public.study_subjects(id) on delete set null,
  subject_name text not null,
  discipline_name text,
  notification_type text not null check (
    notification_type in ('drop_severe','drop','attention','recovery','record','exceptional','evolution')
  ),
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists study_performance_notifications_user_created_idx
  on public.study_performance_notifications(user_id, created_at desc);

alter table public.study_performance_notifications enable row level security;

drop policy if exists "Users can read own performance notifications" on public.study_performance_notifications;
create policy "Users can read own performance notifications"
  on public.study_performance_notifications for select
  using (user_id = auth.uid());

drop policy if exists "Users can create own performance notifications" on public.study_performance_notifications;
create policy "Users can create own performance notifications"
  on public.study_performance_notifications for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update own performance notifications" on public.study_performance_notifications;
create policy "Users can update own performance notifications"
  on public.study_performance_notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.study_performance_notifications to authenticated;
