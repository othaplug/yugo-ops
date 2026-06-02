-- Per-tier price override on residential quotes.
--
-- The existing `quote_price_override` is proportional — admin sets one
-- number and the engine scales all three tiers by the same ratio (see
-- /api/quotes/generate/route.ts ~line 4877). That's wrong when admin
-- wants to discount Estate to match a competitor without dropping
-- Essential/Signature at the same time.
--
-- Shape:
--   {
--     "estate":    { "price": 6000, "reason": "competitive match" },
--     "signature": { "price": 3400, "reason": "repeat client" }
--   }
--
-- Per-key entry only when an override applies. Engine writes
-- `factors_applied.tier_overrides_applied` with original→override pairs
-- on every regenerate so the audit trail survives separately from
-- this raw column (the column reflects current state; factors_applied
-- captures the history).
--
-- Idempotent. Defaults to NULL (no overrides). Existing quotes are
-- valid without backfill.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS tier_price_overrides JSONB;

COMMENT ON COLUMN quotes.tier_price_overrides IS
  'Per-tier override map. Keys: essential | signature | estate. Each entry: { price: number, reason: string }. Applied AFTER engine computes natural tiers in /api/quotes/generate.';

NOTIFY pgrst, 'reload schema';
