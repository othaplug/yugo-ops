-- New tables for the pricing control panel:
-- deposit_rules, office_rates, platform_config.

-- ─────────────────────────────────────────────
-- DEPOSIT RULES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deposit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL,
  amount_bracket TEXT NOT NULL,
  deposit_type TEXT NOT NULL CHECK (deposit_type IN ('full', 'flat', 'percent')),
  deposit_value NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(service_type, amount_bracket)
);

INSERT INTO public.deposit_rules (service_type, amount_bracket, deposit_type, deposit_value) VALUES
  ('residential', 'under_500', 'full', 0),
  ('residential', '500_999', 'flat', 100),
  ('residential', '1000_2999', 'flat', 100),
  ('residential', '3000_4999', 'percent', 10),
  ('residential', '5000_plus', 'percent', 15),
  ('long_distance', 'under_500', 'percent', 25),
  ('long_distance', '500_999', 'percent', 25),
  ('long_distance', '1000_2999', 'percent', 25),
  ('long_distance', '3000_4999', 'percent', 25),
  ('long_distance', '5000_plus', 'percent', 25),
  ('office', 'under_500', 'percent', 30),
  ('office', '500_999', 'percent', 30),
  ('office', '1000_2999', 'percent', 25),
  ('office', '3000_4999', 'percent', 25),
  ('office', '5000_plus', 'percent', 30),
  ('single_item', 'under_500', 'full', 0),
  ('single_item', '500_999', 'full', 0),
  ('single_item', '1000_2999', 'flat', 100),
  ('white_glove', 'under_500', 'full', 0),
  ('white_glove', '500_999', 'flat', 100),
  ('white_glove', '1000_2999', 'flat', 150),
  ('white_glove', '3000_4999', 'percent', 10),
  ('white_glove', '5000_plus', 'percent', 15),
  ('specialty', 'under_500', 'percent', 50),
  ('specialty', '500_999', 'percent', 30),
  ('specialty', '1000_2999', 'percent', 30),
  ('specialty', '3000_4999', 'percent', 30),
  ('specialty', '5000_plus', 'percent', 50)
ON CONFLICT (service_type, amount_bracket) DO NOTHING;

ALTER TABLE public.deposit_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform users can manage deposit_rules" ON public.deposit_rules;
CREATE POLICY "Platform users can manage deposit_rules"
  ON public.deposit_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- OFFICE RATES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.office_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter TEXT UNIQUE NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT NOT NULL
);

INSERT INTO public.office_rates (parameter, value, unit) VALUES
  ('rate_per_sqft', 3.50, '$/sq ft'),
  ('rate_per_workstation', 75, '$/station'),
  ('it_equipment_surcharge', 200, 'flat'),
  ('conference_room', 150, 'flat'),
  ('reception_area', 100, 'flat'),
  ('evening_night_premium', 15, '%'),
  ('minimum_job_amount', 1500, '$')
ON CONFLICT (parameter) DO NOTHING;

ALTER TABLE public.office_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform users can manage office_rates" ON public.office_rates;
CREATE POLICY "Platform users can manage office_rates"
  ON public.office_rates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- PLATFORM CONFIG (key-value for tier multipliers, minimums, etc.)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT
);

INSERT INTO public.platform_config (key, value, description) VALUES
  ('tier_essentials_multiplier', '1.00', 'Essentials tier multiplier'),
  ('tier_premier_multiplier', '1.35', 'Premier tier multiplier'),
  ('tier_estate_multiplier', '1.85', 'Estate tier multiplier'),
  ('minimum_job_amount', '549', 'Minimum job amount in dollars'),
  ('rounding_nearest', '50', 'Round quotes to nearest X dollars'),
  ('tax_rate', '0.13', 'HST tax rate'),
  ('distance_base_km', '30', 'Free km included in base rate'),
  ('distance_rate_per_km', '4.50', 'Rate per extra km beyond base'),
  ('single_item_distance_base', '15', 'Free km for single item'),
  ('single_item_distance_rate', '2.00', 'Rate per km for single item'),
  ('assembly_disassembly', '75', 'Disassembly surcharge'),
  ('assembly_assembly', '80', 'Assembly surcharge'),
  ('assembly_both', '140', 'Both assembly + disassembly'),
  ('stair_carry_per_flight', '50', 'Stair carry per flight')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform users can manage platform_config" ON public.platform_config;
CREATE POLICY "Platform users can manage platform_config"
  ON public.platform_config FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
