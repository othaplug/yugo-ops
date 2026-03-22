-- Ensure public.crew_locations exists for dispatch, tracking, and Realtime.
-- Some environments never applied 20250277000000_crew_locations.sql (or it failed before commit).

CREATE TABLE IF NOT EXISTS public.crew_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  crew_name TEXT,
  vehicle_id TEXT,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  heading NUMERIC,
  speed NUMERIC,
  accuracy NUMERIC,
  status TEXT DEFAULT 'idle' CHECK (status IN (
    'idle','en_route_pickup','at_pickup','loading',
    'en_route_delivery','at_delivery','unloading',
    'returning','offline'
  )),
  current_move_id UUID,
  current_client_name TEXT,
  current_from_address TEXT,
  current_to_address TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crew_locations_crew ON public.crew_locations(crew_id);

CREATE TABLE IF NOT EXISTS public.crew_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL,
  move_id UUID,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  heading NUMERIC,
  speed NUMERIC,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_history_crew ON public.crew_location_history(crew_id, recorded_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crew_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_locations;
  END IF;
END $$;
