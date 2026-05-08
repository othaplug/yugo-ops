-- quote_scenarios: alternative scheduling/pricing options per quote
CREATE TABLE IF NOT EXISTS public.quote_scenarios (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            UUID         NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  scenario_number     INTEGER      NOT NULL DEFAULT 1,
  label               TEXT,
  description         TEXT,
  is_recommended      BOOLEAN      DEFAULT FALSE,
  scenario_date       DATE,
  scenario_time       TEXT,
  price               NUMERIC,
  hst                 NUMERIC,
  total_price         NUMERIC,
  deposit_amount      NUMERIC,
  conditions_note     TEXT,
  status              TEXT         DEFAULT 'pending',
  selected_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (quote_id, scenario_number)
);

ALTER TABLE public.quote_scenarios ENABLE ROW LEVEL SECURITY;

-- Anon/public read (quote page is public)
CREATE POLICY "quote_scenarios_read_all"
  ON public.quote_scenarios FOR SELECT
  USING (true);

-- Service role (admin client) full access
CREATE POLICY "quote_scenarios_service_role_all"
  ON public.quote_scenarios FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookup by quote
CREATE INDEX IF NOT EXISTS idx_quote_scenarios_quote_id
  ON public.quote_scenarios(quote_id);

-- Columns on quotes table
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS is_multi_scenario  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS accepted_scenario_id UUID;
