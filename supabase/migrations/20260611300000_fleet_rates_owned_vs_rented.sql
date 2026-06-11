-- ───────────────────────────────────────────────────────────────────
-- Fleet rate calibration — owned vs rented model (2026-06-11)
--
-- Operator decision after audit of idle-Sprinter cost recovery
-- (~$1,100/mo bleeding unrecovered under the old Model A where
-- fleet was excluded from OH entirely):
--
--   - Owned vehicles (Sprinter) → monthly lease into Monthly OH.
--     Per-job direct cost = $0 (no wear-and-tear charged).
--   - Rented vehicles (16ft / 20ft / 26ft) → stay variable cost,
--     billed per-use at the day rate.
--
-- Rental day rates bumped to reflect current Toronto market (2026):
--   16ft: $70 → $100/day  (Discount, U-Haul, Penske, Enterprise)
--   20ft: $80 → $150/day
--   26ft: $295/day (unchanged — already market)
--
-- Sprinter day rate set to $0 — operator confirmed wear-and-tear is
-- not currently passed through to client/cost stack. Fixed lease is
-- recovered via OH allocation, not per-use.
--
-- These rates feed:
--   - Per-job profit table truck cost line (calculateProfit.ts)
--   - Quote engine truck cost (margin-cost-model.ts estimateTruckCostPerMove)
--   - OH UI Fleet panel "Daily rate used" display
--
-- ON CONFLICT DO UPDATE so the new defaults take effect immediately
-- (these are pricing-engine rates, not user-typed values).
-- ───────────────────────────────────────────────────────────────────

INSERT INTO platform_config (key, value, description) VALUES
  ('truck_daily_cost_sprinter', '0',   'Sprinter per-use day rate. $0 — wear-and-tear not charged. Fixed lease is in Monthly Overhead.'),
  ('truck_daily_cost_16ft',     '100', '16ft rental day rate (Toronto market 2026)'),
  ('truck_daily_cost_20ft',     '150', '20ft rental day rate (Toronto market 2026)'),
  ('truck_daily_cost_26ft',     '295', '26ft rental day rate (Toronto market 2026)')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

NOTIFY pgrst, 'reload schema';
