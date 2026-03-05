-- ===================================================================
-- Rate Cards & B2B Pricing Engine
-- Extends organizations + deliveries, creates rate card tables
-- ===================================================================

-- 1. Extend organizations with B2B pricing fields
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS pricing_tier TEXT DEFAULT 'standard';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS billing_terms TEXT DEFAULT 'prepay';
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS default_pickup_address TEXT;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS default_pickup_lat NUMERIC;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS default_pickup_lng NUMERIC;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS deliveries_per_month INTEGER;

-- 2. Partner rate cards (each org can have one active card)
CREATE TABLE IF NOT EXISTS public.partner_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  card_name TEXT NOT NULL DEFAULT 'Standard Rate Card',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_cards_org_active
  ON public.partner_rate_cards (organization_id)
  WHERE is_active = TRUE;

-- 3. Day rates by vehicle type and pricing tier
CREATE TABLE IF NOT EXISTS public.rate_card_day_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES public.partner_rate_cards(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL,
  full_day_price NUMERIC NOT NULL,
  half_day_price NUMERIC NOT NULL,
  stops_included_full INTEGER NOT NULL DEFAULT 6,
  stops_included_half INTEGER NOT NULL DEFAULT 3,
  pricing_tier TEXT NOT NULL DEFAULT 'partner',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Day rate stop overages
CREATE TABLE IF NOT EXISTS public.rate_card_overages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES public.partner_rate_cards(id) ON DELETE CASCADE,
  overage_tier TEXT NOT NULL,
  price_per_stop NUMERIC NOT NULL,
  pricing_tier TEXT NOT NULL DEFAULT 'partner',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Per-delivery rates by type and zone
CREATE TABLE IF NOT EXISTS public.rate_card_delivery_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES public.partner_rate_cards(id) ON DELETE CASCADE,
  delivery_type TEXT NOT NULL,
  zone INTEGER NOT NULL,
  price_min NUMERIC NOT NULL,
  price_max NUMERIC,
  pricing_tier TEXT NOT NULL DEFAULT 'partner',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Zone definitions and surcharges
CREATE TABLE IF NOT EXISTS public.rate_card_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES public.partner_rate_cards(id) ON DELETE CASCADE,
  zone_number INTEGER NOT NULL,
  zone_name TEXT NOT NULL,
  distance_min_km NUMERIC NOT NULL,
  distance_max_km NUMERIC,
  coverage_areas TEXT,
  surcharge NUMERIC NOT NULL DEFAULT 0,
  pricing_tier TEXT NOT NULL DEFAULT 'partner',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Add-on services
CREATE TABLE IF NOT EXISTS public.rate_card_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES public.partner_rate_cards(id) ON DELETE CASCADE,
  service_slug TEXT NOT NULL,
  service_name TEXT NOT NULL,
  price_min NUMERIC NOT NULL,
  price_max NUMERIC,
  price_unit TEXT DEFAULT 'flat',
  pricing_tier TEXT NOT NULL DEFAULT 'partner',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Volume bonuses
CREATE TABLE IF NOT EXISTS public.rate_card_volume_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES public.partner_rate_cards(id) ON DELETE CASCADE,
  min_deliveries INTEGER NOT NULL,
  max_deliveries INTEGER,
  discount_pct NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Extend deliveries with pricing columns
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS booking_type TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS rate_card_id UUID REFERENCES public.partner_rate_cards(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS day_type TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS num_stops INTEGER;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_type TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS zone INTEGER;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS base_price NUMERIC DEFAULT 0;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS overage_price NUMERIC DEFAULT 0;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS services_price NUMERIC DEFAULT 0;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS zone_surcharge NUMERIC DEFAULT 0;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS after_hours_surcharge NUMERIC DEFAULT 0;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS services_selected JSONB DEFAULT '[]';
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS admin_adjusted_price NUMERIC;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS created_by_source TEXT DEFAULT 'admin';
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS created_by_user UUID REFERENCES auth.users(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS end_customer_name TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS end_customer_phone TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS end_customer_email TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC;

-- 10. Recurring delivery schedules
CREATE TABLE IF NOT EXISTS public.recurring_delivery_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  rate_card_id UUID REFERENCES public.partner_rate_cards(id),
  schedule_name TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  days_of_week INTEGER[] NOT NULL DEFAULT '{}',
  booking_type TEXT NOT NULL DEFAULT 'day_rate',
  vehicle_type TEXT,
  day_type TEXT DEFAULT 'full_day',
  default_num_stops INTEGER,
  default_services JSONB DEFAULT '[]',
  time_window TEXT DEFAULT 'morning',
  default_pickup_address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_paused BOOLEAN DEFAULT FALSE,
  next_generation_date DATE,
  created_by_source TEXT DEFAULT 'partner_portal',
  created_by_user UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Delivery stops (for day-rate multi-stop bookings)
CREATE TABLE IF NOT EXISTS public.delivery_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  stop_number INTEGER NOT NULL,
  address TEXT NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  customer_name TEXT,
  customer_phone TEXT,
  items_description TEXT,
  services_selected JSONB DEFAULT '[]',
  special_instructions TEXT,
  zone INTEGER,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===================================================================
-- RLS policies
-- ===================================================================
ALTER TABLE public.partner_rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_card_day_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_card_overages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_card_delivery_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_card_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_card_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_card_volume_bonuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_delivery_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_stops ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rate_cards_admin_all') THEN
    CREATE POLICY rate_cards_admin_all ON public.partner_rate_cards FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rate_cards_partner_read') THEN
    CREATE POLICY rate_cards_partner_read ON public.partner_rate_cards FOR SELECT
      USING (organization_id IN (SELECT org_id FROM public.partner_users WHERE user_id = auth.uid()));
  END IF;
END $$;

-- Allow admin full access and partners read on all rate sub-tables
DO $$ BEGIN
  EXECUTE 'CREATE POLICY day_rates_admin ON public.rate_card_day_rates FOR ALL USING (true)';
  EXECUTE 'CREATE POLICY overages_admin ON public.rate_card_overages FOR ALL USING (true)';
  EXECUTE 'CREATE POLICY delivery_rates_admin ON public.rate_card_delivery_rates FOR ALL USING (true)';
  EXECUTE 'CREATE POLICY zones_admin ON public.rate_card_zones FOR ALL USING (true)';
  EXECUTE 'CREATE POLICY services_admin ON public.rate_card_services FOR ALL USING (true)';
  EXECUTE 'CREATE POLICY volume_bonuses_admin ON public.rate_card_volume_bonuses FOR ALL USING (true)';
  EXECUTE 'CREATE POLICY recurring_admin ON public.recurring_delivery_schedules FOR ALL USING (true)';
  EXECUTE 'CREATE POLICY stops_admin ON public.delivery_stops FOR ALL USING (true)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===================================================================
-- SEED: Default Furniture Retailer Rate Card Template
-- ===================================================================

-- Create a template rate card (organization_id will be null for templates)
-- We use a known UUID so we can reference it in seed inserts
DO $$
DECLARE
  tmpl_id UUID := 'a0000000-0000-0000-0000-000000000001';
  tmpl_org_id UUID;
BEGIN
  -- Create a template org if not exists
  INSERT INTO public.organizations (id, name, type, notes)
  VALUES ('b0000000-0000-0000-0000-000000000001', '_Rate Card Templates', 'b2c', 'System: holds rate card templates')
  ON CONFLICT (id) DO NOTHING;

  tmpl_org_id := 'b0000000-0000-0000-0000-000000000001';

  -- Create the template rate card
  INSERT INTO public.partner_rate_cards (id, organization_id, card_name, effective_date, is_active)
  VALUES (tmpl_id, tmpl_org_id, 'Furniture Retailer Rate Card', CURRENT_DATE, TRUE)
  ON CONFLICT (id) DO NOTHING;

  -- Day Rates: Partner
  INSERT INTO public.rate_card_day_rates (rate_card_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier) VALUES
    (tmpl_id, 'sprinter', 590, 360, 6, 3, 'partner'),
    (tmpl_id, '16ft',     760, 465, 6, 3, 'partner'),
    (tmpl_id, '20ft',     930, 575, 6, 3, 'partner'),
    (tmpl_id, '26ft',     1185, 720, 6, 3, 'partner')
  ON CONFLICT DO NOTHING;

  -- Day Rates: Standard
  INSERT INTO public.rate_card_day_rates (rate_card_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier) VALUES
    (tmpl_id, 'sprinter', 695, 425, 6, 3, 'standard'),
    (tmpl_id, '16ft',     895, 550, 6, 3, 'standard'),
    (tmpl_id, '20ft',     1095, 675, 6, 3, 'standard'),
    (tmpl_id, '26ft',     1395, 850, 6, 3, 'standard')
  ON CONFLICT DO NOTHING;

  -- Overages: Partner
  INSERT INTO public.rate_card_overages (rate_card_id, overage_tier, price_per_stop, pricing_tier) VALUES
    (tmpl_id, 'full_7_10',    65, 'partner'),
    (tmpl_id, 'full_11_plus', 85, 'partner'),
    (tmpl_id, 'half_4_6',     65, 'partner'),
    (tmpl_id, 'half_7_plus',  85, 'partner')
  ON CONFLICT DO NOTHING;

  -- Overages: Standard
  INSERT INTO public.rate_card_overages (rate_card_id, overage_tier, price_per_stop, pricing_tier) VALUES
    (tmpl_id, 'full_7_10',    85, 'standard'),
    (tmpl_id, 'full_11_plus', 110, 'standard'),
    (tmpl_id, 'half_4_6',     85, 'standard'),
    (tmpl_id, 'half_7_plus',  110, 'standard')
  ON CONFLICT DO NOTHING;

  -- Zones (shared across tiers for Z1-Z2)
  INSERT INTO public.rate_card_zones (rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier) VALUES
    (tmpl_id, 1, 'GTA Core',       0, 15, 'Downtown, Midtown, East/West End, Liberty Village', 0, 'partner'),
    (tmpl_id, 2, 'Inner Suburbs', 15, 30, 'North York, Scarborough, Etobicoke, Mississauga', 95, 'partner'),
    (tmpl_id, 3, 'Outer GTA',     30, 50, 'Vaughan, Markham, Richmond Hill, Oakville', 165, 'partner'),
    (tmpl_id, 4, 'Extended',      50, 80, 'Hamilton, Barrie, Oshawa, Guelph', 250, 'partner'),
    (tmpl_id, 5, 'Remote',        80, NULL, 'Beyond 80km - quoted on request', 0, 'partner'),
    (tmpl_id, 1, 'GTA Core',       0, 15, 'Downtown, Midtown, East/West End, Liberty Village', 0, 'standard'),
    (tmpl_id, 2, 'Inner Suburbs', 15, 30, 'North York, Scarborough, Etobicoke, Mississauga', 115, 'standard'),
    (tmpl_id, 3, 'Outer GTA',     30, 50, 'Vaughan, Markham, Richmond Hill, Oakville', 195, 'standard'),
    (tmpl_id, 4, 'Extended',      50, 80, 'Hamilton, Barrie, Oshawa, Guelph', 295, 'standard'),
    (tmpl_id, 5, 'Remote',        80, NULL, 'Beyond 80km - quoted on request', 0, 'standard')
  ON CONFLICT DO NOTHING;

  -- Per-Delivery: Partner Z1
  INSERT INTO public.rate_card_delivery_rates (rate_card_id, delivery_type, zone, price_min, price_max, pricing_tier) VALUES
    (tmpl_id, 'single_item',  1, 165, 235, 'partner'),
    (tmpl_id, 'multi_piece',  1, 275, 405, 'partner'),
    (tmpl_id, 'full_room',    1, 445, 640, 'partner'),
    (tmpl_id, 'curbside',     1, 105, 150, 'partner'),
    (tmpl_id, 'oversized',    1, 335, NULL, 'partner')
  ON CONFLICT DO NOTHING;

  -- Per-Delivery: Partner Z2
  INSERT INTO public.rate_card_delivery_rates (rate_card_id, delivery_type, zone, price_min, price_max, pricing_tier) VALUES
    (tmpl_id, 'single_item',  2, 235, 295, 'partner'),
    (tmpl_id, 'multi_piece',  2, 360, 490, 'partner'),
    (tmpl_id, 'full_room',    2, 550, 760, 'partner'),
    (tmpl_id, 'curbside',     2, 150, 210, 'partner'),
    (tmpl_id, 'oversized',    2, 420, NULL, 'partner')
  ON CONFLICT DO NOTHING;

  -- Per-Delivery: Standard Z1
  INSERT INTO public.rate_card_delivery_rates (rate_card_id, delivery_type, zone, price_min, price_max, pricing_tier) VALUES
    (tmpl_id, 'single_item',  1, 195, 275, 'standard'),
    (tmpl_id, 'multi_piece',  1, 325, 475, 'standard'),
    (tmpl_id, 'full_room',    1, 525, 750, 'standard'),
    (tmpl_id, 'curbside',     1, 125, 175, 'standard'),
    (tmpl_id, 'oversized',    1, 395, NULL, 'standard')
  ON CONFLICT DO NOTHING;

  -- Per-Delivery: Standard Z2
  INSERT INTO public.rate_card_delivery_rates (rate_card_id, delivery_type, zone, price_min, price_max, pricing_tier) VALUES
    (tmpl_id, 'single_item',  2, 275, 350, 'standard'),
    (tmpl_id, 'multi_piece',  2, 425, 575, 'standard'),
    (tmpl_id, 'full_room',    2, 650, 895, 'standard'),
    (tmpl_id, 'curbside',     2, 175, 250, 'standard'),
    (tmpl_id, 'oversized',    2, 495, NULL, 'standard')
  ON CONFLICT DO NOTHING;

  -- Services: Partner
  INSERT INTO public.rate_card_services (rate_card_id, service_slug, service_name, price_min, price_max, price_unit, pricing_tier) VALUES
    (tmpl_id, 'standard_assembly', 'Standard Assembly', 60, 125, 'flat', 'partner'),
    (tmpl_id, 'complex_assembly', 'Complex Assembly', 125, 255, 'flat', 'partner'),
    (tmpl_id, 'furniture_removal', 'Old Furniture Removal', 80, 165, 'flat', 'partner'),
    (tmpl_id, 'return_pickup', 'Return/Exchange Pickup', 105, 165, 'flat', 'partner'),
    (tmpl_id, 'showroom_transfer', 'Showroom-to-Showroom', 250, NULL, 'flat', 'partner'),
    (tmpl_id, 'staging_setup', 'Staging Setup & Styling', 380, NULL, 'flat', 'partner'),
    (tmpl_id, 'packaging_removal', 'Packaging Removal', 0, 0, 'flat', 'partner'),
    (tmpl_id, 'stair_carry', 'Stair Carry', 40, NULL, 'per_flight', 'partner'),
    (tmpl_id, 'after_hours', 'After Hours Surcharge', 20, NULL, 'percentage', 'partner'),
    (tmpl_id, 'weekend', 'Weekend Surcharge', 10, NULL, 'percentage', 'partner'),
    (tmpl_id, 'multi_stop', 'Additional Stop', 75, NULL, 'per_stop', 'partner')
  ON CONFLICT DO NOTHING;

  -- Services: Standard
  INSERT INTO public.rate_card_services (rate_card_id, service_slug, service_name, price_min, price_max, price_unit, pricing_tier) VALUES
    (tmpl_id, 'standard_assembly', 'Standard Assembly', 75, 150, 'flat', 'standard'),
    (tmpl_id, 'complex_assembly', 'Complex Assembly', 150, 300, 'flat', 'standard'),
    (tmpl_id, 'furniture_removal', 'Old Furniture Removal', 95, 195, 'flat', 'standard'),
    (tmpl_id, 'return_pickup', 'Return/Exchange Pickup', 125, 195, 'flat', 'standard'),
    (tmpl_id, 'showroom_transfer', 'Showroom-to-Showroom', 295, NULL, 'flat', 'standard'),
    (tmpl_id, 'staging_setup', 'Staging Setup & Styling', 450, NULL, 'flat', 'standard'),
    (tmpl_id, 'packaging_removal', 'Packaging Removal', 0, 0, 'flat', 'standard'),
    (tmpl_id, 'stair_carry', 'Stair Carry', 50, NULL, 'per_flight', 'standard'),
    (tmpl_id, 'after_hours', 'After Hours Surcharge', 25, NULL, 'percentage', 'standard'),
    (tmpl_id, 'weekend', 'Weekend Surcharge', 15, NULL, 'percentage', 'standard'),
    (tmpl_id, 'multi_stop', 'Additional Stop', 95, NULL, 'per_stop', 'standard')
  ON CONFLICT DO NOTHING;

  -- Volume bonuses (same for both tiers)
  INSERT INTO public.rate_card_volume_bonuses (rate_card_id, min_deliveries, max_deliveries, discount_pct) VALUES
    (tmpl_id, 10, 30, 0),
    (tmpl_id, 31, 60, 5),
    (tmpl_id, 61, 100, 10),
    (tmpl_id, 101, NULL, 15)
  ON CONFLICT DO NOTHING;
END $$;
