-- Add the deposit capture columns that the move-create flow and several
-- read paths reference but were never migrated. Without these, creating
-- a move with deposit_paid=true (as the Create Move form's last step
-- does) fails with:
--   "Could not find the 'deposit_method' column of 'moves' in the schema cache"
--
-- Writers:
--   - src/app/api/admin/moves/create/route.ts (single move + event move)
--   - src/app/api/admin/quotes/[quoteId]/book-external/route.ts
--   - src/app/api/notify/route.ts
--
-- Readers:
--   - src/app/admin/moves/page.tsx (moves list select)
--   - src/app/api/admin/profitability/route.ts
--
-- Companion columns deposit_amount / deposit_paid_at already exist
-- (moves_expansion / moves_balance_method migrations). This fills the
-- gap so the deposit-capture group is complete: paid flag + amount +
-- method + paid_at + note.
--
-- Idempotent via IF NOT EXISTS. Safe to re-run.

ALTER TABLE moves ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS deposit_method TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS deposit_note TEXT;

-- Backfill: any historical move with deposit_paid_at set is implicitly
-- "deposit paid". Without the backfill, old rows would have NULL/FALSE
-- on deposit_paid even though they have a paid_at timestamp, which
-- would confuse readers that prefer the boolean.
UPDATE moves
SET deposit_paid = TRUE
WHERE deposit_paid IS NOT TRUE
  AND deposit_paid_at IS NOT NULL;
