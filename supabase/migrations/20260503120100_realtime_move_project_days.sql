-- Admin calendar live updates: multi-day residential rows and parent project metadata.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'move_project_days'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.move_project_days;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'move_projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.move_projects;
  END IF;
END $$;
