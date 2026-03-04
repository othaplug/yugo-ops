-- Tracks client interactions on the public quote page.
-- Used for funnel analytics, follow-up triggers, and pricing optimization.

CREATE TABLE IF NOT EXISTS public.quote_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    TEXT NOT NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN (
    'quote_viewed',
    'tier_selected',
    'addon_toggled',
    'contract_started',
    'payment_started',
    'quote_abandoned'
  )),
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_events_quote ON public.quote_events(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_events_type  ON public.quote_events(event_type);
CREATE INDEX IF NOT EXISTS idx_quote_events_time  ON public.quote_events(created_at DESC);

-- RLS: public insert (anon key can write events), admin read
ALTER TABLE public.quote_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_quote_events"
  ON public.quote_events FOR INSERT
  TO anon WITH CHECK (true);

CREATE POLICY "service_role_all_quote_events"
  ON public.quote_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_quote_events"
  ON public.quote_events FOR SELECT
  TO authenticated USING (true);
