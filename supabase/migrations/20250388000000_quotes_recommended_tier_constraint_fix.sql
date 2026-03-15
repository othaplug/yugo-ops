-- ═══════════════════════════════════════════════════════════════
-- Fix quotes_recommended_tier_check so it allows new tier names
-- (curated, signature, estate). Idempotent: safe to run even if
-- 20250387000000_tier_rename_curated_signature already ran.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_recommended_tier_check;

UPDATE quotes SET recommended_tier = 'curated'   WHERE recommended_tier = 'essentials';
UPDATE quotes SET recommended_tier = 'signature' WHERE recommended_tier = 'premier';

ALTER TABLE quotes ADD CONSTRAINT quotes_recommended_tier_check
  CHECK (recommended_tier IN ('curated', 'signature', 'estate'));
