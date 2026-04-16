-- Job duration / margin alert fields for crew timer; quote provenance for widget conversion

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_internal_cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS margin_alert_minutes INTEGER;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_internal_cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS margin_alert_minutes INTEGER;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS quote_source TEXT,
  ADD COLUMN IF NOT EXISTS source_request_id UUID REFERENCES public.quote_requests(id);

ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.moves.estimated_duration_minutes IS 'Planned job length for crew timer (minutes)';
COMMENT ON COLUMN public.moves.margin_alert_minutes IS 'Elapsed minutes threshold before margin warning (crew/admin)';
COMMENT ON COLUMN public.quotes.quote_source IS 'Provenance: direct, widget, referral, partner, etc.';
COMMENT ON COLUMN public.quotes.source_request_id IS 'quote_requests row when quote originated from widget lead';
