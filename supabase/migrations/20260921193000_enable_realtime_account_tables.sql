DO $$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH table_name IN ARRAY ARRAY[
      'study_user_state',
      'study_settings',
      'study_disciplines',
      'study_subjects',
      'study_sources',
      'study_question_types',
      'study_entries'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  END IF;
END $$;
