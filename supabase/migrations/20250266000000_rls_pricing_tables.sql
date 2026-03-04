-- Row Level Security for the pricing/quoting tables created in
-- 20250264000000_core_pricing_schema.sql.
-- Pattern: DROP IF EXISTS + CREATE for idempotency.

-- ─────────────────────────────────────────────
-- Enable RLS on all pricing tables
-- ─────────────────────────────────────────────
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighbourhood_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialty_surcharges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.single_item_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_analytics ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- CONTACTS — admin-only (service_role bypasses RLS)
-- Authenticated platform users can manage contacts.
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Platform users can manage contacts" ON public.contacts;
CREATE POLICY "Platform users can manage contacts"
  ON public.contacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- QUOTES — public read for sent/viewed/accepted; public update for status changes
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Platform users can manage quotes" ON public.quotes;
CREATE POLICY "Platform users can manage quotes"
  ON public.quotes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Public can view sent quotes" ON public.quotes;
CREATE POLICY "Public can view sent quotes"
  ON public.quotes FOR SELECT TO anon
  USING (status IN ('sent', 'viewed', 'accepted') AND quote_id IS NOT NULL);

DROP POLICY IF EXISTS "Public can update quote status" ON public.quotes;
CREATE POLICY "Public can update quote status"
  ON public.quotes FOR UPDATE TO anon
  USING (status IN ('sent', 'viewed'))
  WITH CHECK (status IN ('viewed', 'accepted'));

-- ─────────────────────────────────────────────
-- QUOTE ANALYTICS — admin-only
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Platform users can manage quote_analytics" ON public.quote_analytics;
CREATE POLICY "Platform users can manage quote_analytics"
  ON public.quote_analytics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- LOOKUP / RATE TABLES — read-only for everyone
-- (Admin writes handled by service_role which bypasses RLS)
-- ─────────────────────────────────────────────

-- base_rates
DROP POLICY IF EXISTS "Anyone can read base_rates" ON public.base_rates;
CREATE POLICY "Anyone can read base_rates"
  ON public.base_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform users can manage base_rates" ON public.base_rates;
CREATE POLICY "Platform users can manage base_rates"
  ON public.base_rates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- neighbourhood_tiers
DROP POLICY IF EXISTS "Anyone can read neighbourhood_tiers" ON public.neighbourhood_tiers;
CREATE POLICY "Anyone can read neighbourhood_tiers"
  ON public.neighbourhood_tiers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform users can manage neighbourhood_tiers" ON public.neighbourhood_tiers;
CREATE POLICY "Platform users can manage neighbourhood_tiers"
  ON public.neighbourhood_tiers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- access_scores
DROP POLICY IF EXISTS "Anyone can read access_scores" ON public.access_scores;
CREATE POLICY "Anyone can read access_scores"
  ON public.access_scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform users can manage access_scores" ON public.access_scores;
CREATE POLICY "Platform users can manage access_scores"
  ON public.access_scores FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- date_factors
DROP POLICY IF EXISTS "Anyone can read date_factors" ON public.date_factors;
CREATE POLICY "Anyone can read date_factors"
  ON public.date_factors FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform users can manage date_factors" ON public.date_factors;
CREATE POLICY "Platform users can manage date_factors"
  ON public.date_factors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- specialty_surcharges
DROP POLICY IF EXISTS "Anyone can read specialty_surcharges" ON public.specialty_surcharges;
CREATE POLICY "Anyone can read specialty_surcharges"
  ON public.specialty_surcharges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform users can manage specialty_surcharges" ON public.specialty_surcharges;
CREATE POLICY "Platform users can manage specialty_surcharges"
  ON public.specialty_surcharges FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- single_item_rates
DROP POLICY IF EXISTS "Anyone can read single_item_rates" ON public.single_item_rates;
CREATE POLICY "Anyone can read single_item_rates"
  ON public.single_item_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform users can manage single_item_rates" ON public.single_item_rates;
CREATE POLICY "Platform users can manage single_item_rates"
  ON public.single_item_rates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
