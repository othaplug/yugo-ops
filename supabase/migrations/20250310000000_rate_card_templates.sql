-- ===================================================================
-- Rate Card Templates System
-- Industry templates, partner-level overrides, override hierarchy
-- ===================================================================

-- 1. Industry rate card templates
CREATE TABLE IF NOT EXISTS public.rate_card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  template_slug TEXT NOT NULL UNIQUE,
  description TEXT,
  verticals_covered TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.rate_card_templates (template_name, template_slug, description, verticals_covered) VALUES
  ('Furniture & Design', 'furniture_design',
   'White-glove delivery for furniture retailers, interior designers, cabinetry, and flooring',
   ARRAY['furniture_retailer', 'interior_designer', 'cabinetry', 'flooring']),
  ('Art & Specialty', 'art_specialty',
   'Specialized handling for art galleries, antique dealers, and high-value items',
   ARRAY['art_gallery', 'antique_dealer']),
  ('Hospitality & Commercial', 'hospitality_commercial',
   'Bulk and phased deliveries for hospitality groups and property developers',
   ARRAY['hospitality', 'developer', 'property_manager']),
  ('Medical & Technical', 'medical_technical',
   'Compliance-ready delivery for medical equipment, AV technology, and appliances',
   ARRAY['medical_equipment', 'av_technology', 'appliances']),
  ('Referral Partners', 'referral',
   'Referral tracking for realtors and property managers',
   ARRAY['realtor', 'property_manager'])
ON CONFLICT (template_slug) DO NOTHING;

-- 2. Make rate_card_id nullable on all rate sub-tables so template rows can omit it
DO $$ BEGIN
  ALTER TABLE public.rate_card_day_rates ALTER COLUMN rate_card_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rate_card_delivery_rates ALTER COLUMN rate_card_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rate_card_services ALTER COLUMN rate_card_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rate_card_overages ALTER COLUMN rate_card_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rate_card_zones ALTER COLUMN rate_card_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rate_card_volume_bonuses ALTER COLUMN rate_card_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rate_card_distance_overages ALTER COLUMN rate_card_id DROP NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL; WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rate_card_weight_surcharges ALTER COLUMN rate_card_id DROP NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL; WHEN others THEN NULL; END $$;

-- 3. Add template_id FK to all rate sub-tables
ALTER TABLE public.rate_card_day_rates ADD COLUMN IF NOT EXISTS
  template_id UUID REFERENCES public.rate_card_templates(id) ON DELETE CASCADE;

ALTER TABLE public.rate_card_delivery_rates ADD COLUMN IF NOT EXISTS
  template_id UUID REFERENCES public.rate_card_templates(id) ON DELETE CASCADE;

ALTER TABLE public.rate_card_services ADD COLUMN IF NOT EXISTS
  template_id UUID REFERENCES public.rate_card_templates(id) ON DELETE CASCADE;

ALTER TABLE public.rate_card_overages ADD COLUMN IF NOT EXISTS
  template_id UUID REFERENCES public.rate_card_templates(id) ON DELETE CASCADE;

ALTER TABLE public.rate_card_zones ADD COLUMN IF NOT EXISTS
  template_id UUID REFERENCES public.rate_card_templates(id) ON DELETE CASCADE;

ALTER TABLE public.rate_card_volume_bonuses ADD COLUMN IF NOT EXISTS
  template_id UUID REFERENCES public.rate_card_templates(id) ON DELETE CASCADE;

DO $$ BEGIN
  ALTER TABLE public.rate_card_distance_overages ADD COLUMN IF NOT EXISTS
    template_id UUID REFERENCES public.rate_card_templates(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rate_card_weight_surcharges ADD COLUMN IF NOT EXISTS
    template_id UUID REFERENCES public.rate_card_templates(id) ON DELETE CASCADE;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 4. Add template fields to organizations (partner fields)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS
  template_id UUID REFERENCES public.rate_card_templates(id);
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS
  global_discount_pct NUMERIC DEFAULT 0;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS
  rates_locked BOOLEAN DEFAULT FALSE;

-- 5. Partner rate overrides
CREATE TABLE IF NOT EXISTS public.partner_rate_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rate_table TEXT NOT NULL,
  rate_record_id UUID NOT NULL,
  override_field TEXT NOT NULL,
  override_value NUMERIC NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (partner_id, rate_table, rate_record_id, override_field)
);

-- 6. RLS
ALTER TABLE public.rate_card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_rate_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "rate_templates_public_read" ON public.rate_card_templates
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rate_templates_admin_write" ON public.rate_card_templates
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "rate_overrides_admin_all" ON public.partner_rate_overrides
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. Seed Furniture & Design template rates from the existing seed card
DO $$
DECLARE
  furn_tmpl_id UUID;
  src_card_id UUID := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO furn_tmpl_id FROM public.rate_card_templates
  WHERE template_slug = 'furniture_design' LIMIT 1;

  IF furn_tmpl_id IS NULL THEN RETURN; END IF;

  -- Only seed if template rates don't exist yet
  IF EXISTS (SELECT 1 FROM public.rate_card_day_rates WHERE template_id = furn_tmpl_id LIMIT 1) THEN
    RETURN;
  END IF;

  -- Skip if source card doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.rate_card_day_rates WHERE rate_card_id = src_card_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO public.rate_card_day_rates
    (template_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier)
  SELECT furn_tmpl_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier
  FROM public.rate_card_day_rates WHERE rate_card_id = src_card_id;

  INSERT INTO public.rate_card_overages
    (template_id, overage_tier, price_per_stop, pricing_tier)
  SELECT furn_tmpl_id, overage_tier, price_per_stop, pricing_tier
  FROM public.rate_card_overages WHERE rate_card_id = src_card_id;

  INSERT INTO public.rate_card_delivery_rates
    (template_id, delivery_type, zone, price_min, price_max, pricing_tier)
  SELECT furn_tmpl_id, delivery_type, zone, price_min, price_max, pricing_tier
  FROM public.rate_card_delivery_rates WHERE rate_card_id = src_card_id;

  INSERT INTO public.rate_card_zones
    (template_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier)
  SELECT furn_tmpl_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier
  FROM public.rate_card_zones WHERE rate_card_id = src_card_id;

  INSERT INTO public.rate_card_services
    (template_id, service_slug, service_name, price_min, price_max, price_unit, pricing_tier)
  SELECT furn_tmpl_id, service_slug, service_name, price_min, price_max, price_unit, pricing_tier
  FROM public.rate_card_services WHERE rate_card_id = src_card_id;

  INSERT INTO public.rate_card_volume_bonuses
    (template_id, min_deliveries, max_deliveries, discount_pct)
  SELECT furn_tmpl_id, min_deliveries, max_deliveries, discount_pct
  FROM public.rate_card_volume_bonuses WHERE rate_card_id = src_card_id;

  RAISE NOTICE 'Seeded Furniture & Design template rates from card %', src_card_id;
END $$;

-- 8. Auto-assign Furniture & Design template to existing retail/designer orgs
DO $$
DECLARE
  furn_tmpl_id UUID;
BEGIN
  SELECT id INTO furn_tmpl_id FROM public.rate_card_templates
  WHERE template_slug = 'furniture_design' LIMIT 1;

  IF furn_tmpl_id IS NULL THEN RETURN; END IF;

  UPDATE public.organizations
  SET template_id = furn_tmpl_id
  WHERE template_id IS NULL
    AND type IN ('furniture_retailer','interior_designer','cabinetry','flooring',
                 'retail','designer','b2b');
END $$;
