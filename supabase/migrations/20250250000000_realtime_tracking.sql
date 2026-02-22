-- Enable realtime for moves, deliveries, tracking_sessions so admin gets live updates when crew advances status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'moves') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.moves;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'deliveries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tracking_sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tracking_sessions;
  END IF;
END $$;
