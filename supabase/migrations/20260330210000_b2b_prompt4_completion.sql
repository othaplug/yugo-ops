-- Prompt 4 completion: zone band 80–120 vs 120+, art add-on rates, delivery_verticals mirror columns,
-- optional global weight tier reference (documentation / reporting).

-- 4-band route distance zones for all verticals using zone pricing
UPDATE public.delivery_verticals
SET default_config = jsonb_set(
  COALESCE(default_config, '{}'::jsonb),
  '{distance_zones}',
  '[
    {"min_km": 0, "max_km": 40, "fee": 0},
    {"min_km": 40, "max_km": 80, "fee": 75},
    {"min_km": 80, "max_km": 120, "fee": 150},
    {"min_km": 120, "max_km": 99999, "fee": 175}
  ]'::jsonb,
  true
)
WHERE default_config->>'distance_mode' = 'zones';

-- Art & gallery: priced add-ons (coordinator enters counts on quote form)
UPDATE public.delivery_verticals
SET default_config = jsonb_set(
  COALESCE(default_config, '{}'::jsonb),
  '{complexity_premiums}',
  COALESCE(default_config->'complexity_premiums', '{}'::jsonb)
    || '{"art_hanging_per_piece": 85, "crating_per_piece": 275}'::jsonb,
  true
)
WHERE code = 'art_gallery';

-- Mirror columns (nullable; synced from default_config by app on save)
ALTER TABLE public.delivery_verticals
  ADD COLUMN IF NOT EXISTS items_included_in_base INTEGER,
  ADD COLUMN IF NOT EXISTS per_item_rate_after_base NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS assembly_included BOOLEAN,
  ADD COLUMN IF NOT EXISTS stops_included_in_base INTEGER,
  ADD COLUMN IF NOT EXISTS per_stop_rate NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS skid_handling_fee NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS weight_surcharges JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS handling_levels JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS volume_discount_tiers JSONB DEFAULT '[]'::jsonb;

UPDATE public.delivery_verticals SET items_included_in_base = (default_config->>'items_included_in_base')::integer
WHERE default_config ? 'items_included_in_base';

UPDATE public.delivery_verticals SET per_item_rate_after_base = (default_config->>'per_item_rate_after_base')::numeric
WHERE default_config ? 'per_item_rate_after_base';

UPDATE public.delivery_verticals SET assembly_included = (default_config->>'assembly_included')::boolean
WHERE default_config ? 'assembly_included';

UPDATE public.delivery_verticals SET stops_included_in_base = (default_config->>'stops_included_in_base')::integer
WHERE default_config ? 'stops_included_in_base';

UPDATE public.delivery_verticals SET stops_included_in_base = (default_config->>'free_stops')::integer
WHERE stops_included_in_base IS NULL AND default_config ? 'free_stops';

UPDATE public.delivery_verticals SET per_stop_rate = (default_config->>'stop_rate')::numeric
WHERE default_config ? 'stop_rate';

UPDATE public.delivery_verticals SET skid_handling_fee = (default_config->>'skid_handling_fee')::numeric
WHERE default_config ? 'skid_handling_fee';

UPDATE public.delivery_verticals SET weight_surcharges = default_config->'weight_line_rates'
WHERE default_config ? 'weight_line_rates' AND jsonb_typeof(default_config->'weight_line_rates') = 'object';

UPDATE public.delivery_verticals SET handling_levels = default_config->'handling_rates'
WHERE default_config ? 'handling_rates' AND jsonb_typeof(default_config->'handling_rates') = 'object';

UPDATE public.delivery_verticals SET volume_discount_tiers = default_config->'volume_discount_tiers'
WHERE default_config ? 'volume_discount_tiers' AND jsonb_typeof(default_config->'volume_discount_tiers') = 'array';

-- Reference tiers (global documentation; dollar amounts remain per-vertical in weight_line_rates)
CREATE TABLE IF NOT EXISTS public.b2b_weight_tier_reference (
  id SERIAL PRIMARY KEY,
  tier_key TEXT NOT NULL UNIQUE,
  display_label TEXT NOT NULL,
  typical_min_lb INTEGER,
  typical_max_lb INTEGER,
  notes TEXT
);

INSERT INTO public.b2b_weight_tier_reference (tier_key, display_label, typical_min_lb, typical_max_lb, notes) VALUES
  ('light', 'Standard / light', NULL, 99, 'Furniture retail: under ~100 lb. Dollar surcharges set per vertical.'),
  ('medium', 'Heavy', 100, 199, 'Furniture retail: ~100–200 lb.'),
  ('heavy', 'Very heavy', 200, 399, 'Furniture retail: ~200–400 lb.'),
  ('extra_heavy', 'Extra heavy', 400, NULL, '400+ lb; may trigger mandatory extra crew per vertical config.')
ON CONFLICT (tier_key) DO UPDATE SET
  display_label = EXCLUDED.display_label,
  typical_min_lb = EXCLUDED.typical_min_lb,
  typical_max_lb = EXCLUDED.typical_max_lb,
  notes = EXCLUDED.notes;

ALTER TABLE public.b2b_weight_tier_reference ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.b2b_weight_tier_reference IS 'B2B line weight tier reference (lbs bands); pricing dollars live in delivery_verticals.default_config.weight_line_rates.';
