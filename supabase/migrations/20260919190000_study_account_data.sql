create table if not exists public.study_disciplines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  discipline_id uuid not null references public.study_disciplines(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_question_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.study_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  study_date date not null,
  discipline_id uuid not null references public.study_disciplines(id) on delete restrict,
  subject_id uuid not null references public.study_subjects(id) on delete restrict,
  source_id uuid references public.study_sources(id) on delete set null,
  question_type_id uuid references public.study_question_types(id) on delete set null,
  questions integer not null check (questions > 0),
  correct integer not null check (correct >= 0 and correct <= questions),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_goal integer not null default 100 check (daily_goal > 0),
  target_accuracy numeric(5,2) not null default 80 check (target_accuracy >= 0 and target_accuracy <= 100),
  updated_at timestamptz not null default now()
);

create index if not exists study_disciplines_user_id_idx on public.study_disciplines(user_id);
create index if not exists study_subjects_user_id_idx on public.study_subjects(user_id);
create index if not exists study_sources_user_id_idx on public.study_sources(user_id);
create index if not exists study_question_types_user_id_idx on public.study_question_types(user_id);
create index if not exists study_entries_user_id_date_idx on public.study_entries(user_id, study_date desc);

alter table public.study_disciplines enable row level security;
alter table public.study_subjects enable row level security;
alter table public.study_sources enable row level security;
alter table public.study_question_types enable row level security;
alter table public.study_entries enable row level security;
alter table public.study_settings enable row level security;

drop policy if exists "study_disciplines_owner" on public.study_disciplines;
create policy "study_disciplines_owner" on public.study_disciplines for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "study_subjects_owner" on public.study_subjects;
create policy "study_subjects_owner" on public.study_subjects for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "study_sources_owner" on public.study_sources;
create policy "study_sources_owner" on public.study_sources for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "study_question_types_owner" on public.study_question_types;
create policy "study_question_types_owner" on public.study_question_types for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "study_entries_owner" on public.study_entries;
create policy "study_entries_owner" on public.study_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "study_settings_owner" on public.study_settings;
create policy "study_settings_owner" on public.study_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.set_study_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists study_entries_updated_at on public.study_entries;
create trigger study_entries_updated_at
before update on public.study_entries
for each row execute function public.set_study_updated_at();

drop trigger if exists study_settings_updated_at on public.study_settings;
create trigger study_settings_updated_at
before update on public.study_settings
for each row execute function public.set_study_updated_at();
