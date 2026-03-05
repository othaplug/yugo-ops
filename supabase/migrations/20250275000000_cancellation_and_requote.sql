-- Cancellation tracking on moves
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS refund_amount NUMERIC;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS refund_id TEXT;

-- Quote versioning for re-quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS parent_quote_id UUID REFERENCES public.quotes(id);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Add 'superseded' to the quotes status check constraint
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('draft','sent','viewed','accepted','expired','declined','superseded'));

-- Index for finding latest version of a quote chain
CREATE INDEX IF NOT EXISTS idx_quotes_parent ON public.quotes(parent_quote_id);

-- Distance cache table (Mapbox results)
CREATE TABLE IF NOT EXISTS public.distance_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  distance_km NUMERIC NOT NULL,
  drive_time_min INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_address, to_address)
);

CREATE INDEX IF NOT EXISTS idx_distance_cache_lookup
  ON public.distance_cache(from_address, to_address);

ALTER TABLE public.distance_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_distance_cache') THEN
    CREATE POLICY service_role_distance_cache ON public.distance_cache FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
