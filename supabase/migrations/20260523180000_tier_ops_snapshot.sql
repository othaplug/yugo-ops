-- Tier ops snapshot: preserves what ops flags were active when the quote was created.
-- This freezes the service contract at booking time even if tier definitions change later.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tier_ops_snapshot JSONB;

-- Essential add-ons purchased on this quote (array of {key, quantity, price}).
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS essential_addons JSONB DEFAULT '[]'::jsonb;

-- Estate director info on moves
ALTER TABLE moves ADD COLUMN IF NOT EXISTS estate_director_name TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS estate_director_phone TEXT;

-- Tier ops snapshot on moves (copied from quote at booking time)
ALTER TABLE moves ADD COLUMN IF NOT EXISTS tier_ops_snapshot JSONB;

COMMENT ON COLUMN quotes.tier_ops_snapshot IS 'Snapshot of TIER_DEFINITIONS[tier].ops at quote generation time — preserves service contract.';
COMMENT ON COLUMN quotes.essential_addons IS 'Essential-tier add-ons selected: [{key, quantity, price}]';
COMMENT ON COLUMN moves.tier_ops_snapshot IS 'Copied from quote.tier_ops_snapshot at booking time.';
COMMENT ON COLUMN moves.estate_director_name IS 'Named Estate Move Director assigned to this move.';
COMMENT ON COLUMN moves.estate_director_phone IS 'Direct phone for the Estate Move Director.';
