-- ───────────────────────────────────────────────────────────────────
-- Labour rate calibration — luxury positioning (2026-06-11)
--
-- Bumps the per-mover-hour CHARGE rate applied to overage hours
-- (hours beyond the baseline benchmark for a given move size). These
-- rates feed `tieredLabourDelta` in src/app/api/quotes/generate/route.ts
-- and drive the per-tier price spread when a job runs long.
--
-- Old rates → new rates (operator decision, luxury repositioning):
--   Essential   $55  →  $65   (+18%)
--   Signature   $65  →  $80   (+23%)
--   Estate      $75  →  $95   (+27%)
--
-- Margin implications (cost rate stays at $28/mover-hr loaded):
--                       OLD margin    NEW margin
--   Essential  $65-$28  ($27)  49%    →  ($37)  57%   clears 55% floor
--   Signature  $80-$28  ($37)  57%    →  ($52)  65%   clears 62% floor
--   Estate     $95-$28  ($47)  63%    →  ($67)  71%   clears 70% floor
--
-- Each tier's per-mover-hour gross margin now lands at or above the
-- corresponding luxury true-margin floor surfaced on the quote preview
-- (see PR 5 in commit c557fdf9). Note this rate ONLY applies to
-- overage hours — the base benchmark hours remain priced via the
-- bundled tier price. So the customer-facing total only moves on jobs
-- that exceed the move-size baseline (typically heavier or harder-
-- access jobs that legitimately warrant a higher per-hour rate).
-- ───────────────────────────────────────────────────────────────────

-- UPDATE existing rows in place. UPSERT ensures the keys exist if they
-- somehow got removed since 20260322000002 set them up.
INSERT INTO platform_config (key, value, description) VALUES
  ('labour_rate_essential', '65', 'Labour overage rate per mover-hour for Essential tier (luxury baseline, 2026-06-11)'),
  ('labour_rate_signature', '80', 'Labour overage rate per mover-hour for Signature tier (luxury baseline, 2026-06-11)'),
  ('labour_rate_estate',    '95', 'Labour overage rate per mover-hour for Estate tier (luxury baseline, 2026-06-11)')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

-- Force PostgREST to refresh its schema cache so the new values are
-- immediately visible to API reads (the generate route loads config on
-- every request, so this is belt-and-suspenders, but cheap).
NOTIFY pgrst, 'reload schema';
