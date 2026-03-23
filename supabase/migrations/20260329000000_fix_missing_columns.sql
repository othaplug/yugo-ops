-- ═══════════════════════════════════════════════════════════
-- Fix: add columns that code references but migrations missed
-- ═══════════════════════════════════════════════════════════

-- ── Auto-scheduling audit columns on moves ──
-- auto-schedule.ts writes these but no prior migration added them.
ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS auto_scheduled       BOOLEAN   DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_scheduled_at    TIMESTAMPTZ;

-- ── total_price on moves ──
-- Widely used in admin, daily brief, and revenue forecast.
-- The base schema only has `amount`; total_price was never formally migrated.
ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS total_price          NUMERIC;

-- Backfill: where total_price is null, copy from amount so existing moves
-- show correct revenue immediately.
UPDATE moves
SET total_price = amount
WHERE total_price IS NULL AND amount IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_moves_auto_scheduled ON moves (auto_scheduled)
  WHERE auto_scheduled = TRUE;
