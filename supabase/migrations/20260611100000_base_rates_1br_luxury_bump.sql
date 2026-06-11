-- ───────────────────────────────────────────────────────────────────
-- 1BR base rate bump — luxury positioning (2026-06-11)
--
-- Operator review of YG-30286 (1BR Toronto move, 23 items + 25 boxes,
-- elevator both ends): engine generated Essential $600, which put the
-- effective labour rate at $49/mover-hr — below the $50/mover-hr
-- floor enforced by the rate-check guardrail.
--
-- Root cause: 1BR base rate at $499 was calibrated for budget-mover
-- positioning. For luxury / white-glove brand positioning, base needs
-- to put even the cheapest tier comfortably above the labour floor.
--
-- Math after this bump ($600 base):
--   $600 × 1.0 (inventory) × 0.92 (distance) × 1.16 (date) ≈ $640
--     subtotal before flat additions
--   Essential ≈ $720 (engine, matching the override the operator was
--     already manually applying)
--   Effective rate: $720 / 2 movers / 4.5h = $80/hr labour portion
--     after non-labour netted → $60/mover-hr → clears $50 floor ✓
--
-- Studio and partial NOT bumped here — those are intentionally
-- accessible price points for downsizing seniors and partial moves.
-- 2BR ($799), 3BR/4BR/5BR base rates also unchanged in this pass.
-- ───────────────────────────────────────────────────────────────────

UPDATE base_rates SET base_price = 600 WHERE move_size = '1br';

-- Force PostgREST to refresh schema cache so the new value is
-- immediately visible to API reads.
NOTIFY pgrst, 'reload schema';
