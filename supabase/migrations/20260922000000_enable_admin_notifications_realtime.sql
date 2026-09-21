-- Make administrator-created notifications visible through Supabase Realtime.
-- The client also polls as a fallback, so delivery does not depend on a single websocket.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'mcr_admin_notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.mcr_admin_notifications;
    END IF;
  END IF;
END $$;
