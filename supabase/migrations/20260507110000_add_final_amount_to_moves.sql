-- ═══════════════════════════════════════════════════════════
-- Fix: add final_amount to moves table
-- ═══════════════════════════════════════════════════════════
-- Used by:
--   - /api/admin/job-final-price (Adjust final price modal)
--   - post-payment.ts (set after Square payment)
--   - revenue-forecast-data.ts, MoveDetailClient profitability
--   - invoices/auto-move route
-- The column was referenced throughout the codebase but was never
-- added to moves via a migration.

ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS final_amount NUMERIC;

-- Backfill: copy from total_price or amount so existing completed moves
-- already have a value for the profitability / revenue displays.
UPDATE moves
SET final_amount = COALESCE(total_price, amount)
WHERE final_amount IS NULL
  AND COALESCE(total_price, amount) IS NOT NULL;
