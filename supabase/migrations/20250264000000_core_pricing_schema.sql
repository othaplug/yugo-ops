-- Core pricing & quoting schema for the Yugo quoting engine.
-- Adds: contacts, quotes, base_rates, neighbourhood_tiers, access_scores,
--        date_factors, specialty_surcharges, single_item_rates, quote_analytics.

-- ─────────────────────────────────────────────
-- CONTACTS (synced from HubSpot)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_contact_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  lead_source TEXT DEFAULT 'website',
  neighbourhood TEXT,
  postal_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_hubspot ON public.contacts(hubspot_contact_id);

-- ─────────────────────────────────────────────
-- QUOTES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id TEXT UNIQUE NOT NULL,
  hubspot_deal_id TEXT,
  contact_id UUID REFERENCES public.contacts(id),
  service_type TEXT NOT NULL CHECK (service_type IN (
    'local_move','long_distance','office_move','single_item',
    'white_glove','specialty','b2b_delivery'
  )),
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft','sent','viewed','accepted','expired','declined'
  )),
  from_address TEXT NOT NULL,
  from_access TEXT,
  from_postal TEXT,
  to_address TEXT NOT NULL,
  to_access TEXT,
  to_postal TEXT,
  move_date DATE,
  move_size TEXT,
  distance_km NUMERIC,
  drive_time_min INTEGER,
  specialty_items JSONB DEFAULT '[]',
  tiers JSONB,
  custom_price NUMERIC,
  deposit_amount NUMERIC,
  selected_tier TEXT,
  factors_applied JSONB,
  quote_url TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_deal ON public.quotes(hubspot_deal_id);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_id ON public.quotes(quote_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);

-- ─────────────────────────────────────────────
-- BASE RATES (residential move size → base price)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.base_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_size TEXT UNIQUE NOT NULL,
  base_price NUMERIC NOT NULL,
  min_crew INTEGER DEFAULT 2,
  estimated_hours NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.base_rates (move_size, base_price, min_crew, estimated_hours) VALUES
  ('studio', 549, 2, 3),
  ('1br', 799, 2, 4),
  ('2br', 1199, 3, 5),
  ('3br', 1699, 3, 7),
  ('4br', 2399, 4, 8),
  ('5br_plus', 3199, 4, 10),
  ('partial', 499, 2, 3)
ON CONFLICT (move_size) DO NOTHING;

-- ─────────────────────────────────────────────
-- NEIGHBOURHOOD TIERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.neighbourhood_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postal_prefix TEXT UNIQUE NOT NULL,
  neighbourhood_name TEXT,
  tier TEXT CHECK (tier IN ('A','B','C','D')),
  multiplier NUMERIC DEFAULT 1.00,
  avg_income_bracket TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.neighbourhood_tiers (postal_prefix, neighbourhood_name, tier, multiplier) VALUES
  ('M5R', 'Yorkville', 'A', 1.15),
  ('M4W', 'Rosedale', 'A', 1.15),
  ('M4V', 'Forest Hill', 'A', 1.15),
  ('M5K', 'St Lawrence / Financial', 'A', 1.12),
  ('M5V', 'King West / Entertainment', 'A', 1.12),
  ('M5J', 'Harbourfront', 'B', 1.08),
  ('M5A', 'Corktown / Distillery', 'B', 1.08),
  ('M4P', 'Davisville', 'B', 1.05),
  ('M4N', 'Lawrence Park', 'B', 1.08),
  ('M4E', 'The Beaches', 'B', 1.05),
  ('M6G', 'Christie', 'C', 1.00),
  ('M6H', 'Dovercourt', 'C', 1.00),
  ('M4B', 'East York', 'C', 1.00),
  ('M4C', 'East York South', 'C', 1.00),
  ('M4J', 'East End', 'C', 1.00),
  ('M4K', 'Riverdale', 'C', 1.02),
  ('M6K', 'Parkdale', 'C', 1.00),
  ('M1B', 'Scarborough East', 'D', 0.95),
  ('M1C', 'Rouge', 'D', 0.95),
  ('M1E', 'Morningside', 'D', 0.95),
  ('M9V', 'Etobicoke South', 'D', 0.95),
  ('M9W', 'Etobicoke West', 'D', 0.95)
ON CONFLICT (postal_prefix) DO NOTHING;

-- ─────────────────────────────────────────────
-- ACCESS SCORES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.access_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_type TEXT UNIQUE NOT NULL,
  surcharge NUMERIC DEFAULT 0,
  notes TEXT
);

INSERT INTO public.access_scores (access_type, surcharge) VALUES
  ('elevator', 0),
  ('ground_floor', 0),
  ('loading_dock', 0),
  ('walk_up_2nd', 75),
  ('walk_up_3rd', 150),
  ('walk_up_4th_plus', 250),
  ('long_carry', 100),
  ('narrow_stairs', 100),
  ('no_parking_nearby', 50)
ON CONFLICT (access_type) DO NOTHING;

-- ─────────────────────────────────────────────
-- DATE FACTORS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.date_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factor_type TEXT NOT NULL,
  factor_value TEXT NOT NULL,
  multiplier NUMERIC DEFAULT 1.00,
  UNIQUE(factor_type, factor_value)
);

INSERT INTO public.date_factors (factor_type, factor_value, multiplier) VALUES
  ('day_of_week', 'monday', 1.00),
  ('day_of_week', 'tuesday', 1.00),
  ('day_of_week', 'wednesday', 1.00),
  ('day_of_week', 'thursday', 1.00),
  ('day_of_week', 'friday', 1.05),
  ('day_of_week', 'saturday', 1.10),
  ('day_of_week', 'sunday', 1.10),
  ('month_period', 'month_end', 1.08),
  ('season', 'peak_jun_aug', 1.10),
  ('season', 'shoulder_sep_nov', 1.00),
  ('season', 'off_peak_jan_mar', 0.92),
  ('season', 'spring_apr_may', 1.02),
  ('urgency', 'last_minute_7days', 1.15),
  ('urgency', 'early_bird_30plus', 0.95)
ON CONFLICT (factor_type, factor_value) DO NOTHING;

-- ─────────────────────────────────────────────
-- SPECIALTY SURCHARGES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.specialty_surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT UNIQUE NOT NULL,
  surcharge NUMERIC NOT NULL,
  requires_specialty_crew BOOLEAN DEFAULT FALSE,
  notes TEXT
);

INSERT INTO public.specialty_surcharges (item_type, surcharge, requires_specialty_crew) VALUES
  ('piano_upright', 200, true),
  ('piano_grand', 450, true),
  ('pool_table', 350, true),
  ('safe_under_300lbs', 150, false),
  ('safe_over_300lbs', 250, true),
  ('hot_tub', 500, true),
  ('artwork_per_piece', 30, false),
  ('antique_per_piece', 50, false),
  ('wine_collection', 200, false),
  ('gym_equipment_per_piece', 40, false),
  ('motorcycle', 300, true),
  ('aquarium', 250, true)
ON CONFLICT (item_type) DO NOTHING;

-- ─────────────────────────────────────────────
-- SINGLE ITEM RATES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.single_item_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_category TEXT UNIQUE NOT NULL,
  base_price_min NUMERIC NOT NULL,
  base_price_max NUMERIC NOT NULL,
  weight_class TEXT,
  notes TEXT
);

INSERT INTO public.single_item_rates (item_category, base_price_min, base_price_max, weight_class) VALUES
  ('standard_furniture', 199, 349, 'under_150lbs'),
  ('large_heavy', 349, 599, '150_to_500lbs'),
  ('fragile_specialty', 299, 499, 'varies'),
  ('appliance', 199, 349, 'varies'),
  ('multiple_2_to_5', 349, 699, 'varies'),
  ('oversized', 599, 1800, 'over_500lbs')
ON CONFLICT (item_category) DO NOTHING;

-- ─────────────────────────────────────────────
-- QUOTE ANALYTICS (conversion optimization)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id),
  outcome TEXT CHECK (outcome IN ('won','lost','expired','pending')),
  lost_reason TEXT,
  quoted_amount NUMERIC,
  final_amount NUMERIC,
  neighbourhood_tier TEXT,
  move_size TEXT,
  service_type TEXT,
  season TEXT,
  day_of_week TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_outcome ON public.quote_analytics(outcome);
CREATE INDEX IF NOT EXISTS idx_analytics_tier ON public.quote_analytics(neighbourhood_tier);

-- Enable realtime for quotes (admin dashboard live updates)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'quotes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
  END IF;
END $$;
