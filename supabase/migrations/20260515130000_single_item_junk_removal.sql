-- Single-item junk removal: enable the existing addons.junk_removal row for
-- single_item quotes (previously restricted to local_move / long_distance /
-- office_move), and add a flat-fee pricing model specific to single_item.
--
-- Why two pricing models:
--   * Residential moves (existing): tiered addon price by truck volume —
--     Small load $150 / Half truck $350 / Full truck $600 — plus a labour
--     stop fee ($50 one side / $100 both sides). Reflects the truck-volume
--     reality of a full-house move.
--   * Single-item jobs (new): flat $149 base for ≤2 items, +$50 per extra
--     item. Single-item is too small for truck-volume tiers; pricing
--     scales linearly with the number of items being hauled.
--
-- The engine in calcSingleItem (route.ts) ignores the addon's tier price
-- for single_item and applies the flat formula instead, using
-- quote_items_count_for_junk if set or falling back to 1.

-- 1) Open the addon to single_item visibility.
UPDATE addons
   SET applicable_service_types = (
     SELECT array_agg(DISTINCT x)
       FROM unnest(applicable_service_types || ARRAY['single_item']) AS x
   )
 WHERE slug = 'junk_removal';

-- 2) Pricing config for the single-item flat formula.
INSERT INTO platform_config (key, value, description) VALUES
  ('single_item_junk_removal_base',      '149', 'Base junk removal fee on single-item jobs — covers up to 2 items'),
  ('single_item_junk_removal_per_extra', '50',  'Per-extra-item fee on single-item junk removal beyond the first 2')
ON CONFLICT (key) DO UPDATE
  SET value       = EXCLUDED.value,
      description = EXCLUDED.description;

-- 3) Optional count column — coordinator captures the rough number of
--    items being hauled so the flat formula can scale. Stays NULL for
--    residential junk removal (their pricing uses the addon tier).
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS junk_items_count INTEGER;
