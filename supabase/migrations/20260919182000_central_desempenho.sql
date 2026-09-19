create extension if not exists pgcrypto;

create table if not exists public.disciplines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  discipline_id uuid not null references public.disciplines(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,discipline_id,name)
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);

create table if not exists public.question_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name)
);

create table if not exists public.study_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  study_date date not null default current_date,
  discipline_id uuid not null references public.disciplines(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  source_id uuid references public.sources(id) on delete set null,
  question_type_id uuid references public.question_types(id) on delete set null,
  questions integer not null check (questions > 0),
  correct integer not null check (correct >= 0 and correct <= questions),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_goal integer not null default 100 check (daily_goal > 0),
  target_accuracy numeric(5,2) not null default 80 check (target_accuracy between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_entries_date_idx on public.study_entries(user_id,study_date);
create index if not exists study_entries_discipline_idx on public.study_entries(user_id,discipline_id);
create index if not exists study_entries_subject_idx on public.study_entries(user_id,subject_id);
create index if not exists study_entries_source_idx on public.study_entries(user_id,source_id);
create index if not exists study_entries_type_idx on public.study_entries(user_id,question_type_id);

alter table public.disciplines enable row level security;
alter table public.subjects enable row level security;
alter table public.sources enable row level security;
alter table public.question_types enable row level security;
alter table public.study_entries enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "users own disciplines" on public.disciplines;
create policy "users own disciplines" on public.disciplines for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "users own subjects" on public.subjects;
create policy "users own subjects" on public.subjects for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "users own sources" on public.sources;
create policy "users own sources" on public.sources for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "users own question types" on public.question_types;
create policy "users own question types" on public.question_types for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "users own study entries" on public.study_entries;
create policy "users own study entries" on public.study_entries for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "users own settings" on public.user_settings;
create policy "users own settings" on public.user_settings for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

create or replace function public.validate_entry_subject_discipline()
returns trigger language plpgsql security definer set search_path=public as $$
declare subject_discipline uuid;
begin
  select discipline_id into subject_discipline from public.subjects where id=new.subject_id and user_id=auth.uid();
  if subject_discipline is null or subject_discipline <> new.discipline_id then
    raise exception 'O assunto não pertence à disciplina selecionada.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_entry_subject_discipline on public.study_entries;
create trigger validate_entry_subject_discipline before insert or update on public.study_entries
for each row execute function public.validate_entry_subject_discipline();

create or replace function public.validate_entry_relations()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.disciplines where id=new.discipline_id and user_id=auth.uid()) then
    raise exception 'Disciplina inválida.';
  end if;
  if new.source_id is not null and not exists(select 1 from public.sources where id=new.source_id and user_id=auth.uid()) then
    raise exception 'Banca/origem inválida.';
  end if;
  if new.question_type_id is not null and not exists(select 1 from public.question_types where id=new.question_type_id and user_id=auth.uid()) then
    raise exception 'Tipo inválido.';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_entry_relations on public.study_entries;
create trigger validate_entry_relations before insert or update on public.study_entries
for each row execute function public.validate_entry_relations();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;

drop trigger if exists disciplines_touch on public.disciplines; create trigger disciplines_touch before update on public.disciplines for each row execute function public.touch_updated_at();
drop trigger if exists subjects_touch on public.subjects; create trigger subjects_touch before update on public.subjects for each row execute function public.touch_updated_at();
drop trigger if exists sources_touch on public.sources; create trigger sources_touch before update on public.sources for each row execute function public.touch_updated_at();
drop trigger if exists question_types_touch on public.question_types; create trigger question_types_touch before update on public.question_types for each row execute function public.touch_updated_at();
drop trigger if exists study_entries_touch on public.study_entries; create trigger study_entries_touch before update on public.study_entries for each row execute function public.touch_updated_at();
drop trigger if exists user_settings_touch on public.user_settings; create trigger user_settings_touch before update on public.user_settings for each row execute function public.touch_updated_at();

create or replace function public.ensure_user_settings()
returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.user_settings(user_id) values(new.id) on conflict do nothing; return new; end; $$;

drop trigger if exists on_auth_user_settings on auth.users;
create trigger on_auth_user_settings after insert on auth.users for each row execute function public.ensure_user_settings();

insert into public.user_settings(user_id)
select id from auth.users on conflict do nothing;
