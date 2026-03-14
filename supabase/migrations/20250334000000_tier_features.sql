-- Editable tier/package feature lists for each service type.
-- These replace the hardcoded includes arrays in the quote generate route.

CREATE TABLE IF NOT EXISTS public.tier_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL,
  tier TEXT NOT NULL,      -- 'essentials' | 'premier' | 'estate' | 'custom'
  feature TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_type, tier, feature)
);

CREATE INDEX IF NOT EXISTS idx_tier_features_lookup
  ON public.tier_features(service_type, tier, active, display_order);

ALTER TABLE public.tier_features ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role manages tier_features"
    ON public.tier_features FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated can read tier_features"
    ON public.tier_features FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- SEED: Residential (local_move) — 3 tiers
-- ─────────────────────────────────────────────
INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  -- Essentials
  ('local_move', 'essentials', 'Dedicated moving truck',            1),
  ('local_move', 'essentials', 'Professional movers',               2),
  ('local_move', 'essentials', 'Moving blankets',                   3),
  ('local_move', 'essentials', 'Basic disassembly & reassembly',    4),
  ('local_move', 'essentials', 'Floor runners',                     5),
  -- Premier (includes everything from essentials)
  ('local_move', 'premier', 'Dedicated moving truck',               1),
  ('local_move', 'premier', 'Professional movers',                  2),
  ('local_move', 'premier', 'Moving blankets',                      3),
  ('local_move', 'premier', 'Basic disassembly & reassembly',       4),
  ('local_move', 'premier', 'Floor runners',                        5),
  ('local_move', 'premier', 'Full furniture wrapping',              6),
  ('local_move', 'premier', 'Mattress covers',                      7),
  ('local_move', 'premier', 'TV screen protection',                 8),
  ('local_move', 'premier', 'Premium furniture pads',               9),
  ('local_move', 'premier', 'Dolly service',                       10),
  -- Estate (includes everything from premier)
  ('local_move', 'estate', 'Dedicated moving truck',                1),
  ('local_move', 'estate', 'Professional movers',                   2),
  ('local_move', 'estate', 'Moving blankets',                       3),
  ('local_move', 'estate', 'Basic disassembly & reassembly',        4),
  ('local_move', 'estate', 'Floor runners',                         5),
  ('local_move', 'estate', 'Full furniture wrapping',               6),
  ('local_move', 'estate', 'Mattress covers',                       7),
  ('local_move', 'estate', 'TV screen protection',                  8),
  ('local_move', 'estate', 'Premium furniture pads',                9),
  ('local_move', 'estate', 'Dolly service',                        10),
  ('local_move', 'estate', 'Full packing & unpacking',             11),
  ('local_move', 'estate', 'Custom crating for fragile items',     12),
  ('local_move', 'estate', 'Premium gloves handling',              13),
  ('local_move', 'estate', 'Dedicated move coordinator',           14)
ON CONFLICT (service_type, tier, feature) DO NOTHING;

-- ─────────────────────────────────────────────
-- SEED: Long Distance
-- ─────────────────────────────────────────────
INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('long_distance', 'custom', 'Climate-controlled truck',                1),
  ('long_distance', 'custom', 'Full packing included',                   2),
  ('long_distance', 'custom', 'Professional crew',                       3),
  ('long_distance', 'custom', 'Door-to-door service',                    4),
  ('long_distance', 'custom', 'Furniture disassembly & reassembly',      5),
  ('long_distance', 'custom', 'Moving blankets & shrink wrap',           6)
ON CONFLICT (service_type, tier, feature) DO NOTHING;

-- ─────────────────────────────────────────────
-- SEED: Office / Commercial
-- ─────────────────────────────────────────────
INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('office_move', 'custom', 'Professional moving crew',                  1),
  ('office_move', 'custom', 'Moving truck(s) as needed',                 2),
  ('office_move', 'custom', 'Furniture disassembly & reassembly',        3),
  ('office_move', 'custom', 'Floor & door frame protection',             4),
  ('office_move', 'custom', 'Labeled crate system',                      5)
ON CONFLICT (service_type, tier, feature) DO NOTHING;

-- ─────────────────────────────────────────────
-- SEED: Single Item
-- ─────────────────────────────────────────────
INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('single_item', 'custom', 'Professional 2-person crew',                1),
  ('single_item', 'custom', 'Blanket wrapping',                          2),
  ('single_item', 'custom', 'Secure transport',                          3),
  ('single_item', 'custom', 'Doorstep delivery',                         4)
ON CONFLICT (service_type, tier, feature) DO NOTHING;

-- ─────────────────────────────────────────────
-- SEED: White Glove
-- ─────────────────────────────────────────────
INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('white_glove', 'custom', 'Premium gloves handling',                   1),
  ('white_glove', 'custom', 'Professional 2-person crew',                2),
  ('white_glove', 'custom', 'Full assembly included',                    3),
  ('white_glove', 'custom', 'Photo documentation (before/during/after)', 4),
  ('white_glove', 'custom', 'Packaging removal',                         5),
  ('white_glove', 'custom', 'Blanket & pad wrapping',                    6),
  ('white_glove', 'custom', 'Secure climate transport',                  7)
ON CONFLICT (service_type, tier, feature) DO NOTHING;

-- ─────────────────────────────────────────────
-- SEED: Specialty / Event
-- ─────────────────────────────────────────────
INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('specialty', 'custom', 'Specialized handling crew',                   1),
  ('specialty', 'custom', 'Project-specific equipment',                  2),
  ('specialty', 'custom', 'Site assessment',                             3),
  ('specialty', 'custom', 'Insurance coverage',                          4)
ON CONFLICT (service_type, tier, feature) DO NOTHING;

-- ─────────────────────────────────────────────
-- SEED: B2B One-Off (inherits white glove features)
-- ─────────────────────────────────────────────
INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('b2b_delivery', 'custom', 'Premium gloves handling',                  1),
  ('b2b_delivery', 'custom', 'Professional 2-person crew',               2),
  ('b2b_delivery', 'custom', 'Full assembly included',                   3),
  ('b2b_delivery', 'custom', 'Photo documentation (before/during/after)',4),
  ('b2b_delivery', 'custom', 'Packaging removal',                        5),
  ('b2b_delivery', 'custom', 'Blanket & pad wrapping',                   6),
  ('b2b_delivery', 'custom', 'Secure climate transport',                 7)
ON CONFLICT (service_type, tier, feature) DO NOTHING;
