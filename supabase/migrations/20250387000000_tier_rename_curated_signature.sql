-- ═══════════════════════════════════════════════════════════════
-- Prompt 87: Rename tiers  Essentials → Curated, Premier → Signature
-- ═══════════════════════════════════════════════════════════════

-- ── moves table ──────────────────────────────────────────────
ALTER TABLE moves DROP CONSTRAINT IF EXISTS moves_tier_selected_check;

UPDATE moves SET tier_selected = 'curated'   WHERE tier_selected = 'essentials';
UPDATE moves SET tier_selected = 'signature' WHERE tier_selected = 'premier';

ALTER TABLE moves ADD CONSTRAINT moves_tier_selected_check
  CHECK (tier_selected IN ('curated', 'signature', 'estate'));

-- ── quotes table (tiers JSON keys + recommended_tier) ────────
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_recommended_tier_check;

UPDATE quotes
SET tiers = (
  jsonb_set(
    jsonb_set(
      tiers::jsonb,
      '{curated}',
      tiers::jsonb -> 'essentials'
    ),
    '{signature}',
    tiers::jsonb -> 'premier'
  ) - 'essentials' - 'premier'
)
WHERE tiers IS NOT NULL
  AND tiers::jsonb ? 'essentials';

UPDATE quotes SET recommended_tier = 'curated'   WHERE recommended_tier = 'essentials';
UPDATE quotes SET recommended_tier = 'signature' WHERE recommended_tier = 'premier';

ALTER TABLE quotes ADD CONSTRAINT quotes_recommended_tier_check
  CHECK (recommended_tier IN ('curated', 'signature', 'estate'));

-- ── valuation_tiers table (column is tier_slug) ───────────────
UPDATE valuation_tiers SET tier_slug = 'curated'   WHERE tier_slug = 'essentials';
UPDATE valuation_tiers SET tier_slug = 'signature' WHERE tier_slug = 'premier';

-- ── valuation_upgrades (from_package column) ─────────────────
UPDATE valuation_upgrades SET from_package = 'curated'   WHERE from_package = 'essentials';
UPDATE valuation_upgrades SET from_package = 'signature' WHERE from_package = 'premier';

-- ── tier_features table ──────────────────────────────────────
UPDATE tier_features SET tier = 'curated'   WHERE tier = 'essentials';
UPDATE tier_features SET tier = 'signature' WHERE tier = 'premier';

-- ── email_templates (column is template_slug) ─────────────────
UPDATE email_templates
  SET template_slug = REPLACE(template_slug, 'essentials', 'curated')
  WHERE template_slug LIKE '%essentials%';

UPDATE email_templates
  SET template_slug = REPLACE(template_slug, 'premier', 'signature')
  WHERE template_slug LIKE '%premier%';

-- ── platform_config (tier multiplier keys) ───────────────────
UPDATE platform_config
  SET key   = 'tier_curated_multiplier',
      value = value
  WHERE key = 'tier_essentials_multiplier';

UPDATE platform_config
  SET key   = 'tier_signature_multiplier',
      value = value
  WHERE key = 'tier_premier_multiplier';

-- Any other platform_config values that embed tier names
UPDATE platform_config
  SET value = REPLACE(value, 'essentials', 'curated')
  WHERE value LIKE '%essentials%';

UPDATE platform_config
  SET value = REPLACE(value, 'premier', 'signature')
  WHERE value LIKE '%premier%';

-- ── deposit_rules (service_type column is unaffected; no tier col) ─
-- No changes needed — deposit_rules uses service_type, not tier names.
