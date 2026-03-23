-- ═══════════════════════════════════════════════════════════════
-- Rename tier key: curated → essential (across all tables)
-- Display was already "Essential"; this aligns the internal key.
-- ═══════════════════════════════════════════════════════════════

-- ── moves table ─────────────────────────────────────────────────
ALTER TABLE moves DROP CONSTRAINT IF EXISTS moves_tier_selected_check;

UPDATE moves SET tier_selected = 'essential' WHERE tier_selected = 'curated';

ALTER TABLE moves ADD CONSTRAINT moves_tier_selected_check
  CHECK (tier_selected IN ('essential', 'signature', 'estate'));

-- ── quotes table (recommended_tier + tiers JSON keys) ───────────
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_recommended_tier_check;

UPDATE quotes
SET tiers = (
  jsonb_set(tiers::jsonb, '{essential}', tiers::jsonb -> 'curated') - 'curated'
)
WHERE tiers IS NOT NULL
  AND tiers::jsonb ? 'curated';

UPDATE quotes SET recommended_tier = 'essential' WHERE recommended_tier = 'curated';

ALTER TABLE quotes ADD CONSTRAINT quotes_recommended_tier_check
  CHECK (recommended_tier IN ('essential', 'signature', 'estate'));

-- ── tier_features table ──────────────────────────────────────────
UPDATE tier_features SET tier = 'essential' WHERE tier = 'curated';

-- Replace Essential (local_move) feature list with updated copy
DELETE FROM public.tier_features
  WHERE service_type = 'local_move' AND tier = 'essential';

INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('local_move', 'essential', 'Dedicated moving truck',                1),
  ('local_move', 'essential', 'Professional movers',                   2),
  ('local_move', 'essential', 'Protective wrapping for key furniture', 3),
  ('local_move', 'essential', 'Basic disassembly & reassembly',        4),
  ('local_move', 'essential', 'Floor & entryway protection',           5),
  ('local_move', 'essential', 'All standard equipment included',       6),
  ('local_move', 'essential', 'Standard valuation coverage',           7),
  ('local_move', 'essential', 'Real-time GPS tracking',                8);

-- Replace Signature (local_move) feature list with updated copy
DELETE FROM public.tier_features
  WHERE service_type = 'local_move' AND tier = 'signature';

INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('local_move', 'signature', 'Dedicated moving truck',                 1),
  ('local_move', 'signature', 'Professional movers',                    2),
  ('local_move', 'signature', 'Full protective wrapping for all furniture', 3),
  ('local_move', 'signature', 'Basic disassembly & reassembly',         4),
  ('local_move', 'signature', 'Floor & door frame protection',          5),
  ('local_move', 'signature', 'Mattress and TV protection included',    6),
  ('local_move', 'signature', 'Room-of-choice placement throughout',    7),
  ('local_move', 'signature', 'Wardrobe box for immediate use',         8),
  ('local_move', 'signature', 'Debris and packing removal at completion', 9),
  ('local_move', 'signature', 'All equipment included',                 10),
  ('local_move', 'signature', 'Enhanced valuation coverage',            11),
  ('local_move', 'signature', 'Real-time GPS tracking',                 12);

-- Replace Estate (local_move) feature list with updated copy
DELETE FROM public.tier_features
  WHERE service_type = 'local_move' AND tier = 'estate';

INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('local_move', 'estate', 'Dedicated moving truck',                      1),
  ('local_move', 'estate', 'Professional movers',                         2),
  ('local_move', 'estate', 'Dedicated move coordinator from booking to final placement', 3),
  ('local_move', 'estate', 'Pre-move walkthrough with room-by-room plan', 4),
  ('local_move', 'estate', 'Full furniture wrapping and protection throughout', 5),
  ('local_move', 'estate', 'Full disassembly & precision reassembly',     6),
  ('local_move', 'estate', 'Floor and property protection throughout',    7),
  ('local_move', 'estate', 'Mattress and TV protection included',         8),
  ('local_move', 'estate', 'All packing materials and supplies included', 9),
  ('local_move', 'estate', 'White glove handling for furniture, art, and high-value items', 10),
  ('local_move', 'estate', 'Precision placement in every room',           11),
  ('local_move', 'estate', 'Full replacement valuation coverage',         12),
  ('local_move', 'estate', 'Wardrobe box included',                       13),
  ('local_move', 'estate', 'Debris and packaging removal',                14),
  ('local_move', 'estate', 'Pre-move inventory planning and oversight',   15),
  ('local_move', 'estate', 'Premium handling for art, antiques, and specialty items', 16),
  ('local_move', 'estate', '30-day post-move concierge support',          17),
  ('local_move', 'estate', 'Real-time GPS tracking',                      18),
  ('local_move', 'estate', 'Exclusive partner offers & perks',            19);

-- ── quotes table — curated_price column rename ───────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'curated_price'
  ) THEN
    ALTER TABLE quotes RENAME COLUMN curated_price TO essential_price;
  END IF;
END$$;

-- ── valuation_tiers table ────────────────────────────────────────
UPDATE valuation_tiers SET tier_slug = 'essential' WHERE tier_slug = 'curated';

-- ── valuation_upgrades (from_package column) ─────────────────────
UPDATE valuation_upgrades SET from_package = 'essential' WHERE from_package = 'curated';

-- ── platform_config — tier multiplier & pricing keys ────────────
UPDATE platform_config SET key = 'tier_essential_multiplier'    WHERE key = 'tier_curated_multiplier';
UPDATE platform_config SET key = 'margin_target_essential'      WHERE key = 'margin_target_curated';
UPDATE platform_config SET key = 'deposit_essential_pct'        WHERE key = 'deposit_curated_pct';
UPDATE platform_config SET key = 'deposit_essential_min'        WHERE key = 'deposit_curated_min';
UPDATE platform_config SET key = 'min_essential_signature_gap'  WHERE key = 'min_curated_signature_gap';
UPDATE platform_config SET key = 'max_essential_signature_gap'  WHERE key = 'max_curated_signature_gap';
UPDATE platform_config SET key = 'labour_rate_essential'        WHERE key = 'labour_rate_curated';

-- Any remaining platform_config values that embed the word "curated"
UPDATE platform_config
  SET value = REPLACE(value::text, 'curated', 'essential')
  WHERE value::text LIKE '%curated%';
