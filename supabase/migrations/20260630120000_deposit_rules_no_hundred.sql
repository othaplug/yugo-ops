-- ───────────────────────────────────────────────────────────────────
-- Deposit rules audit (2026-06-30, corrected to policy 2026-07-06)
--
-- Operator (2026-06-30): "for all white glove, full payment is due at
-- booking. not deposit of $100. we dont even do deposit of $100 anymore.
-- investigate why it says this and fix it. also do a full audit on other
-- service quote types and make sure we dont have deposit of $100
-- anywhere."
--
-- Operator (2026-07-06 revert to plan): The original 2026-06-30
-- migration bumped residential $100 flats to $150 flats. That's wrong
-- policy — the established plan is percentage-based (Essential 10 %,
-- Signature 10 %, Estate 25 %), not any flat number. Same for the
-- unknown-service fallback in the engine. This migration is rewritten
-- to match the plan; the engine's hardcoded fallbacks are updated in
-- lockstep (route.ts calculateDeposit + calculateTieredDeposit
-- default branches).
--
-- Traced YG-30356 (white glove, $757 total → $100 deposit) to
-- deposit_rules seed migration 20250268000000 which stamped $100 flats
-- across white_glove / residential / single_item at the small-value
-- brackets. That seed pre-dates the current pricing floor.
--
-- Policy shipped here:
--
-- 1. white_glove — ALL brackets → full payment. Small scope, high
--    margin, doesn't warrant a deposit-then-balance flow.
-- 2. single_item — ALL brackets → full payment.
-- 3. residential — ALL non-full brackets → percent 10. The residential
--    tier-aware path in calculateTieredDeposit() overrides this for
--    tiered quotes (E/S 10 %, Estate 25 %); these DB rows only apply
--    when tier is missing.
-- 4. b2b_delivery + b2b_oneoff — ALL brackets → full payment. Partners
--    on invoice terms settle Net 30 outside this flow; the deposit
--    flow only fires for one-off unregistered bookings.
-- 5. long_distance — ALL brackets → percent 50.
-- ───────────────────────────────────────────────────────────────────

-- ── 1. white_glove: full payment across all brackets ──
UPDATE public.deposit_rules
SET deposit_type = 'full', deposit_value = 0
WHERE service_type = 'white_glove';

-- ── 2. single_item: full payment across all brackets ──
UPDATE public.deposit_rules
SET deposit_type = 'full', deposit_value = 0
WHERE service_type = 'single_item';

-- ── 3. residential: percentage-based at 10 % (tier path overrides) ──
UPDATE public.deposit_rules
SET deposit_type = 'percent', deposit_value = 10
WHERE service_type = 'residential'
  AND deposit_type <> 'full';  -- keep the under_500 full-payment row

-- ── 4. long_distance: 50 % across all brackets ──
UPDATE public.deposit_rules
SET deposit_type = 'percent', deposit_value = 50
WHERE service_type = 'long_distance';

-- ── 5. b2b_delivery + b2b_oneoff: seed as full payment ──
--    These service_types never had deposit_rules rows, so the engine
--    fell through to the hardcoded fallback. Seeding explicit rows
--    keeps behaviour visible to anyone querying the table.
INSERT INTO public.deposit_rules (service_type, amount_bracket, deposit_type, deposit_value) VALUES
  ('b2b_delivery', 'under_500',   'full', 0),
  ('b2b_delivery', '500_999',     'full', 0),
  ('b2b_delivery', '1000_2999',   'full', 0),
  ('b2b_delivery', '3000_4999',   'full', 0),
  ('b2b_delivery', '5000_plus',   'full', 0),
  ('b2b_oneoff',   'under_500',   'full', 0),
  ('b2b_oneoff',   '500_999',     'full', 0),
  ('b2b_oneoff',   '1000_2999',   'full', 0),
  ('b2b_oneoff',   '3000_4999',   'full', 0),
  ('b2b_oneoff',   '5000_plus',   'full', 0)
ON CONFLICT (service_type, amount_bracket) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- ───────────────────────────────────────────────────────────────────
-- SAFE BACKFILL PROCEDURE for existing in-flight quotes
-- (run manually AFTER this migration lands, NOT inside it)
--
-- The migration above only updates the deposit_rules table. Existing
-- quote rows keep whatever deposit_amount was stamped at generate time,
-- so a WG quote in the "sent" state still shows $100 until it either
-- gets regenerated or you backfill deposit_amount directly.
--
-- Order matters: SELECT first (outside any transaction) to review
-- scope, then run the UPDATE in an explicit transaction. Never run
-- the UPDATE before you've read the SELECT output — a mistake at that
-- point is a rollback you have to remember to do.
--
-- STEP 1 — audit scope. Read the output before doing anything else.
--
--   SELECT quote_id, service_type, custom_price, deposit_amount,
--          status, updated_at
--   FROM quotes
--   WHERE service_type = 'white_glove'
--     AND deposit_amount IS NOT NULL
--     AND deposit_amount < 200
--     AND status IN ('draft', 'sent', 'viewed', 'reactivated')
--   ORDER BY updated_at DESC;
--
-- STEP 2 — only if Step 1 looks right, run the UPDATE. The
-- COALESCE picks the selected tier's total when set, else the
-- custom_price rounded up by HST.
--
--   BEGIN;
--   UPDATE quotes q
--   SET deposit_amount = ROUND(
--     COALESCE(
--       (q.tiers -> q.selected_tier ->> 'total')::numeric,
--       q.custom_price * 1.13
--     )
--   )
--   WHERE service_type = 'white_glove'
--     AND deposit_amount IS NOT NULL
--     AND deposit_amount < 200
--     AND status IN ('draft', 'sent', 'viewed', 'reactivated');
--   -- verify one more time before committing:
--   SELECT quote_id, deposit_amount FROM quotes
--     WHERE service_type = 'white_glove' AND status = 'sent'
--     ORDER BY updated_at DESC LIMIT 20;
--   COMMIT;   -- or ROLLBACK; if the SELECT looks wrong
--
-- STEP 3 — same shape for single_item and long_distance / event /
-- b2b if you have open quotes that missed the new policy. Change
-- the WHERE service_type filter and the deposit_amount calculation
-- to match the target service's rule (full = total; percent = total
-- * pct).
--
-- STEP 4 — if the SELECT in Step 1 came back empty, nothing to do.
-- No transaction was ever opened, so nothing to roll back.
-- ───────────────────────────────────────────────────────────────────
