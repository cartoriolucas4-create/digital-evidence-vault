-- Preserve historical launch context while allowing the study catalog to be reset.
alter table public.study_entries
  add column if not exists discipline_name_snapshot text,
  add column if not exists subject_name_snapshot text,
  add column if not exists source_name_snapshot text,
  add column if not exists question_type_name_snapshot text;

update public.study_entries e
set
  discipline_name_snapshot = coalesce(e.discipline_name_snapshot, d.name),
  subject_name_snapshot = coalesce(e.subject_name_snapshot, s.name),
  source_name_snapshot = coalesce(e.source_name_snapshot, so.name),
  question_type_name_snapshot = coalesce(e.question_type_name_snapshot, qt.name)
from public.study_disciplines d
left join public.study_subjects s on s.id = e.subject_id
left join public.study_sources so on so.id = e.source_id
left join public.study_question_types qt on qt.id = e.question_type_id
where e.discipline_id = d.id;

alter table public.study_entries
  drop constraint if exists study_entries_discipline_id_fkey,
  drop constraint if exists study_entries_subject_id_fkey,
  drop constraint if exists study_entries_source_id_fkey,
  drop constraint if exists study_entries_question_type_id_fkey;

alter table public.study_entries
  alter column discipline_id drop not null,
  alter column subject_id drop not null;

alter table public.study_entries
  add constraint study_entries_discipline_id_fkey
    foreign key (discipline_id) references public.study_disciplines(id) on delete set null,
  add constraint study_entries_subject_id_fkey
    foreign key (subject_id) references public.study_subjects(id) on delete set null,
  add constraint study_entries_source_id_fkey
    foreign key (source_id) references public.study_sources(id) on delete set null,
  add constraint study_entries_question_type_id_fkey
    foreign key (question_type_id) references public.study_question_types(id) on delete set null;

create or replace function public.clear_study_catalog(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Não autorizado';
  end if;

  update public.study_entries e
  set
    discipline_name_snapshot = coalesce(e.discipline_name_snapshot, d.name),
    subject_name_snapshot = coalesce(e.subject_name_snapshot, s.name),
    source_name_snapshot = coalesce(e.source_name_snapshot, so.name),
    question_type_name_snapshot = coalesce(e.question_type_name_snapshot, qt.name)
  from public.study_disciplines d
  left join public.study_subjects s on s.id = e.subject_id
  left join public.study_sources so on so.id = e.source_id
  left join public.study_question_types qt on qt.id = e.question_type_id
  where e.user_id = p_user_id
    and e.discipline_id = d.id;

  delete from public.study_subjects where user_id = p_user_id;
  delete from public.study_disciplines where user_id = p_user_id;
  delete from public.study_sources where user_id = p_user_id;
  delete from public.study_question_types where user_id = p_user_id;
end;
$$;

revoke all on function public.clear_study_catalog(uuid) from public;
grant execute on function public.clear_study_catalog(uuid) to authenticated;
