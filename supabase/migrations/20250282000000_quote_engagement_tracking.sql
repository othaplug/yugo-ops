-- ══════════════════════════════════════════════════
-- Quote Engagement Tracking (Prompt 52)
-- ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.quote_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'page_view',
    'tier_clicked',
    'tier_hovered',
    'addon_toggled',
    'contract_viewed',
    'payment_started',
    'payment_abandoned',
    'comparison_viewed',
    'call_crew_clicked',
    'page_exit'
  )),
  event_data JSONB,
  session_duration_seconds INTEGER,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_quote ON public.quote_engagement(quote_id);
CREATE INDEX IF NOT EXISTS idx_engagement_type ON public.quote_engagement(event_type);

ALTER TABLE public.quote_engagement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public insert engagement" ON public.quote_engagement FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read engagement" ON public.quote_engagement FOR SELECT USING (true);

-- Add engagement summary column to quotes for fast follow-up queries
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS engagement_summary JSONB;
