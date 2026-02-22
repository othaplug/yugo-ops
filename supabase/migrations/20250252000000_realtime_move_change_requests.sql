-- Enable realtime for move_change_requests so admin notification bar and sidebar dot update when client submits a change request
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'move_change_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.move_change_requests;
  END IF;
END $$;
