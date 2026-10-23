-- Align the cloud settings table with fields persisted by the MCR app.
-- This is additive only: existing rows and student records are preserved.
ALTER TABLE public.study_settings
  ADD COLUMN IF NOT EXISTS student_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS weekly_goal integer NOT NULL DEFAULT 500 CHECK (weekly_goal > 0),
  ADD COLUMN IF NOT EXISTS monthly_goal integer NOT NULL DEFAULT 2000 CHECK (monthly_goal > 0);
