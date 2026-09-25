-- MSK / QConcursos import support.
alter table if exists public.study_entries
  add column if not exists external_question_id text,
  add column if not exists external_source text,
  add column if not exists filter_discipline text,
  add column if not exists filter_subject text,
  add column if not exists external_session_id text,
  add column if not exists source_topic_path text[],
  add column if not exists captured_at timestamptz;

alter table if exists public.study_entries
  drop constraint if exists study_entries_external_unique;

alter table if exists public.study_entries
  add constraint study_entries_external_unique
  unique (user_id, external_source, external_question_id);

create index if not exists study_entries_external_question_idx
  on public.study_entries(user_id, external_source, external_question_id);

comment on column public.study_entries.external_question_id is 'Stable question identifier from an external question platform, used to prevent duplicate imports.';
comment on column public.study_entries.external_source is 'External platform identifier, e.g. qconcursos.';
comment on column public.study_entries.filter_subject is 'Subject selected by the user in the external platform filter; child topics do not replace this value.';
