-- Realtime INSERTs for admin activity feed (LiveActivityFeed + /admin/activity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'status_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.status_events;
  END IF;
END $$;
