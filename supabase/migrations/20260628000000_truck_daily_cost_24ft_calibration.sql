-- ───────────────────────────────────────────────────────────────────
-- 24ft rental day-rate calibration (2026-06-28)
--
-- Operator review of MV-30320 (24ft Box Truck, 2 same-day jobs):
-- profitability table showed truck cost \$58 (= \$115/day ÷ 2). The
-- \$115 default was stale — it was carried forward from the old
-- platform_config seed and missed in the 2026-06-11 fleet rate
-- calibration migration (which updated 16ft \$70→\$100 and 20ft
-- \$80→\$150 but left 24ft alone).
--
-- Toronto rental market 2026 (verified across Penske, U-Haul,
-- Discount, Enterprise): 24ft cube/box truck ~\$180-\$220/day. Setting
-- to \$200 — sits in the middle of the band with room for insurance/
-- coverage add-ons typically bundled at this size class.
--
-- Effect: a 24ft job standalone now charges \$200 truck cost; split
-- across 2 same-day jobs charges \$100 each. MV-30320 example reads
-- truck \$100 instead of \$58 — honest market cost.
--
-- ON CONFLICT DO UPDATE because this is an engine/pricing constant
-- (not user-typed input). The new value should apply on the next
-- generated quote, not wait for operator to manually adjust.
-- ───────────────────────────────────────────────────────────────────

INSERT INTO platform_config (key, value, description) VALUES
  ('truck_daily_cost_24ft', '200', '24ft rental day rate (Toronto market 2026)')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

NOTIFY pgrst, 'reload schema';
