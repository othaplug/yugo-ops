-- Base-rate competitiveness pass for studio / 1BR / 2BR / partial moves.
--
-- Context: YG-30281 was producing Essential at $900 for a 1BR walk-up
-- 8km Sunday move with light inventory (score 15.6). Toronto market for
-- the same job is $500–$700 on mid-market movers, $700–$900 on premium.
-- The Essential tier multiplier is 1.00, so Essential price ≈ base_rate
-- × inventory_modifier + access + market_stack. Lowering base_rate at
-- the small end of the curve pulls the whole tier ladder down for
-- studio / 1BR / 2BR / partial without touching 3BR+ where the
-- platform's tier multipliers are already calibrated.
--
-- 3BR remains the anchor row: it's the size the Signature 1.52x and
-- Estate 3.35x multipliers were tuned against (see SIGNATURE_SIZE_FACTOR
-- and ESTATE_SIZE_FACTOR in src/app/api/quotes/generate/route.ts). 4BR
-- and 5BR_plus are also unchanged — base rates at those sizes are not
-- the issue.
--
-- Effect on YG-30281 (1BR, score 15.6, walk-ups at both ends, Sunday):
--   Before: Essential $900 / Signature $1,050 / Estate $2,050
--   After:  Essential $750 / Signature $900   / Estate $1,750
-- (illustrative — actual numbers depend on inventory + date + access)
--
-- These values are still editable in platform_config via the admin
-- Pricing Settings page. The migration only resets the baseline.

UPDATE base_rates SET base_price = 399 WHERE move_size = 'studio';
UPDATE base_rates SET base_price = 499 WHERE move_size = '1br';
UPDATE base_rates SET base_price = 799 WHERE move_size = '2br';
UPDATE base_rates SET base_price = 349 WHERE move_size = 'partial';
-- 3br / 4br / 5br_plus deliberately unchanged.
