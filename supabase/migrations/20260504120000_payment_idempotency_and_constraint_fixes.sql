-- ═══════════════════════════════════════════════════════════════════
-- Payment idempotency & constraint fixes
--
-- 1. Add Square payment columns to quotes so that a captured payment
--    survives a move-creation crash; subsequent retries skip re-charging.
-- 2. Fix moves_tier_selected_check to explicitly allow NULL (service types
--    like white_glove and specialty don't use tier slugs).
-- ═══════════════════════════════════════════════════════════════════

-- ── quotes: Square payment idempotency columns ────────────────────
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS square_payment_id  TEXT,
  ADD COLUMN IF NOT EXISTS square_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS square_card_id     TEXT,
  ADD COLUMN IF NOT EXISTS deposit_amount     NUMERIC;

-- ── moves: repair the tier constraint to allow NULL ───────────────
ALTER TABLE public.moves DROP CONSTRAINT IF EXISTS moves_tier_selected_check;
ALTER TABLE public.moves
  ADD CONSTRAINT moves_tier_selected_check
  CHECK (tier_selected IS NULL OR tier_selected IN ('essential', 'signature', 'estate'));
