-- ───────────────────────────────────────────────────────────────────
-- Rental day-rate revision (2026-06-28)
--
-- Operator adjustment after MV-30320 review — three rentals revised
-- down from prior calibration to reflect actual current contract
-- pricing (likely volume / repeat-rental discount with provider):
--   16ft: $100 → $80
--   20ft: $150 → $120
--   24ft: $200 → $150
--   26ft: $295 (unchanged)
--   sprinter: $0 (owned; lease in Monthly Overhead — unchanged)
--
-- ON CONFLICT DO UPDATE so new rates apply immediately on next quote.
-- ───────────────────────────────────────────────────────────────────

INSERT INTO platform_config (key, value, description) VALUES
  ('truck_daily_cost_16ft', '80',  '16ft rental day rate (operator-set 2026-06-28)'),
  ('truck_daily_cost_20ft', '120', '20ft rental day rate (operator-set 2026-06-28)'),
  ('truck_daily_cost_24ft', '150', '24ft rental day rate (operator-set 2026-06-28)')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

NOTIFY pgrst, 'reload schema';
