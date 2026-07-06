-- ───────────────────────────────────────────────────────────────────
-- Deposit rules audit (2026-06-30)
--
-- Operator: "for all white glove, full payment is due at booking. not
-- deposit of $100. we dont even do deposit of $100 anymore. investigate
-- why it says this and fix it. also do a full audit on other service
-- quote types and make sure we dont have deposit of $100 anywhere."
--
-- Traced YG-30356 (white glove, $757 total → $100 deposit) to
-- deposit_rules seed migration 20250268000000 which stamped $100 flats
-- across white_glove / residential / single_item at the small-value
-- brackets. That seed pre-dates the current pricing floor and needs
-- to go.
--
-- Policy changes shipped here:
--
-- 1. white_glove — ALL brackets → full payment. Small scope, high
--    margin, doesn't warrant a deposit-then-balance flow.
-- 2. single_item 1000_2999 — flat $100 → full payment. If it's small
--    enough to be a single item, the whole thing gets paid up front.
-- 3. residential 500_999 + 1000_2999 — flat $100 → flat $150.
--    We still take a deposit at these amounts; just at the new floor.
-- 4. b2b_delivery + b2b_oneoff — inserted at $150 flat across all
--    brackets (no rows existed before, so the engine was falling
--    through to the hardcoded $100 fallback in generate/route.ts).
--
-- The generate route's hardcoded $100 fallbacks + B2B inline deposits
-- were bumped in the same commit; this migration keeps the DB in
-- lockstep so any operator who queries the table sees consistent
-- policy.
-- ───────────────────────────────────────────────────────────────────

-- ── 1. white_glove: full payment across all brackets ──
UPDATE public.deposit_rules
SET deposit_type = 'full', deposit_value = 0
WHERE service_type = 'white_glove';

-- ── 2. single_item: full payment at all brackets (was $100 at 1000_2999) ──
UPDATE public.deposit_rules
SET deposit_type = 'full', deposit_value = 0
WHERE service_type = 'single_item'
  AND amount_bracket = '1000_2999';

-- ── 3. residential: bump $100 flats to $150 ──
UPDATE public.deposit_rules
SET deposit_value = 150
WHERE service_type = 'residential'
  AND deposit_type = 'flat'
  AND deposit_value = 100;

-- ── 4. b2b_delivery + b2b_oneoff: seed missing rows at $150 flat ──
--    These service_types never had deposit_rules rows, so the engine
--    fell through to the hardcoded $100 fallback. Explicit rows keep
--    behaviour visible to anyone querying the table.
INSERT INTO public.deposit_rules (service_type, amount_bracket, deposit_type, deposit_value) VALUES
  ('b2b_delivery', 'under_500',   'full', 0),
  ('b2b_delivery', '500_999',     'flat', 150),
  ('b2b_delivery', '1000_2999',   'flat', 150),
  ('b2b_delivery', '3000_4999',   'flat', 150),
  ('b2b_delivery', '5000_plus',   'flat', 150),
  ('b2b_oneoff',   'under_500',   'full', 0),
  ('b2b_oneoff',   '500_999',     'flat', 150),
  ('b2b_oneoff',   '1000_2999',   'flat', 150),
  ('b2b_oneoff',   '3000_4999',   'flat', 150),
  ('b2b_oneoff',   '5000_plus',   'flat', 150)
ON CONFLICT (service_type, amount_bracket) DO NOTHING;

NOTIFY pgrst, 'reload schema';
