-- Store the student's preferred display name for personalized MCR greetings and notifications.
ALTER TABLE public.study_settings
  ADD COLUMN IF NOT EXISTS student_name text NOT NULL DEFAULT '';

ALTER TABLE public.study_settings
  DROP CONSTRAINT IF EXISTS study_settings_student_name_length_check;

ALTER TABLE public.study_settings
  ADD CONSTRAINT study_settings_student_name_length_check
  CHECK (char_length(student_name) <= 80);
