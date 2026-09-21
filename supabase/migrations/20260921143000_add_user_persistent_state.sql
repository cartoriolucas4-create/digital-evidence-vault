create table if not exists public.study_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  planner_data jsonb,
  preferences jsonb not null default '{}'::jsonb,
  discipline_order jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.study_user_state enable row level security;

drop policy if exists "study_user_state_select_own" on public.study_user_state;
create policy "study_user_state_select_own"
on public.study_user_state for select
using (auth.uid() = user_id);

drop policy if exists "study_user_state_insert_own" on public.study_user_state;
create policy "study_user_state_insert_own"
on public.study_user_state for insert
with check (auth.uid() = user_id);

drop policy if exists "study_user_state_update_own" on public.study_user_state;
create policy "study_user_state_update_own"
on public.study_user_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "study_user_state_delete_own" on public.study_user_state;
create policy "study_user_state_delete_own"
on public.study_user_state for delete
using (auth.uid() = user_id);

create index if not exists study_user_state_updated_at_idx on public.study_user_state(updated_at);

create or replace function public.set_study_user_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists study_user_state_updated_at on public.study_user_state;
create trigger study_user_state_updated_at
before update on public.study_user_state
for each row execute function public.set_study_user_state_updated_at();