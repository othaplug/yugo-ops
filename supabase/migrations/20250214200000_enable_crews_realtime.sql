-- Enable Supabase Realtime for crews table (live GPS tracking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'crews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crews;
  END IF;
END $$;
