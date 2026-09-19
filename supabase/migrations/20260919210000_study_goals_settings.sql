-- Extend study settings with weekly and monthly question goals.
ALTER TABLE public.study_settings
  ADD COLUMN IF NOT EXISTS weekly_goal integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS monthly_goal integer NOT NULL DEFAULT 2000;

ALTER TABLE public.study_settings
  DROP CONSTRAINT IF EXISTS study_settings_weekly_goal_check,
  DROP CONSTRAINT IF EXISTS study_settings_monthly_goal_check;

ALTER TABLE public.study_settings
  ADD CONSTRAINT study_settings_weekly_goal_check CHECK (weekly_goal > 0),
  ADD CONSTRAINT study_settings_monthly_goal_check CHECK (monthly_goal > 0);
