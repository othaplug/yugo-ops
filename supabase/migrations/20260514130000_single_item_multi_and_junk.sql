-- Phase 1 of the Single Item multi-item + junk-removal stop refactor.
--
-- Two related changes shipped together:
--
-- 1) quote_items JSONB array
--    Replaces the single (item_description, item_category, item_weight_class,
--    assembly_needed, stair_carry) scalars with a per-item array of up to 8
--    rows. Backward-compatible: when quote_items is empty, the pricing engine
--    falls back to reading the legacy scalars. Existing accepted quotes
--    continue to work without remediation.
--
--    Shape (validated in app code, not DB):
--      { id, item_description, item_category, weight_class,
--        assembly, stair_carry, stair_flights?, quantity }
--    item_category values stay aligned with our existing ITEM_CATEGORIES enum
--    (small_light, standard_furniture, large_heavy, appliance, oversized,
--    fragile_specialty). assembly stays "none" | "Yes" | "Both".
--
-- 2) junk_removal stop details
--    When the junk_removal addon is selected, the coordinator captures:
--      - where on the move to pick up the junk (origin / destination / both)
--      - what items get removed (internal log + truck-tier sanity check)
--    We deliberately do NOT capture a drop-off address. The crew uses any
--    facility (incl. Yugo office) on their own schedule. Pricing is the
--    addon tier (Small/Half/Full truck) plus a stop-labour fee — no
--    distance/route math, no client-facing dump location.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS junk_pickup_from TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'quotes_junk_pickup_from_check'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT quotes_junk_pickup_from_check
      CHECK (junk_pickup_from IS NULL OR junk_pickup_from IN ('origin','destination','both'));
  END IF;
END $$;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS junk_items_description TEXT;

-- Junk-removal stop labour fee. Disposal + truck volume is already covered
-- by the addons.junk_removal tier price; this fee covers the labour minutes
-- spent loading junk at the move location.
INSERT INTO platform_config (key, value) VALUES
  ('junk_stop_fee_one_side',  '50'),
  ('junk_stop_fee_both_sides','100')
ON CONFLICT (key) DO NOTHING;
