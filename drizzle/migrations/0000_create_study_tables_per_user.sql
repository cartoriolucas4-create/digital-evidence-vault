-- Catálogo e lançamentos por usuário autenticado

CREATE TABLE public.disciplines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplines TO authenticated;
GRANT ALL ON public.disciplines TO service_role;
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disciplines own select" ON public.disciplines FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "disciplines own insert" ON public.disciplines FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "disciplines own update" ON public.disciplines FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "disciplines own delete" ON public.disciplines FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discipline_id uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, discipline_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects own select" ON public.subjects FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "subjects own insert" ON public.subjects FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "subjects own update" ON public.subjects FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "subjects own delete" ON public.subjects FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources own select" ON public.sources FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sources own insert" ON public.sources FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sources own update" ON public.sources FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sources own delete" ON public.sources FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.question_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_types TO authenticated;
GRANT ALL ON public.question_types TO service_role;
ALTER TABLE public.question_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "types own select" ON public.question_types FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "types own insert" ON public.question_types FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "types own update" ON public.question_types FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "types own delete" ON public.question_types FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.study_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date date NOT NULL DEFAULT current_date,
  discipline_id uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  question_type_id uuid REFERENCES public.question_types(id) ON DELETE SET NULL,
  questions integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX study_entries_user_date_idx ON public.study_entries (user_id, study_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_entries TO authenticated;
GRANT ALL ON public.study_entries TO service_role;
ALTER TABLE public.study_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries own select" ON public.study_entries FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "entries own insert" ON public.study_entries FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "entries own update" ON public.study_entries FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "entries own delete" ON public.study_entries FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER study_entries_updated_at BEFORE UPDATE ON public.study_entries
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_goal integer NOT NULL DEFAULT 100,
  target_accuracy integer NOT NULL DEFAULT 80,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings own select" ON public.user_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "settings own insert" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "settings own update" ON public.user_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
