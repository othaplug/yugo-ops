-- ───────────────────────────────────────────────────────────────────
-- Crew wages + payroll burden config (2026-06-11)
--
-- Replaces the opaque $28 "loaded crew rate" with explicit per-role
-- base wages + payroll burden percentages so the engine derives
-- labour cost from auditable inputs.
--
-- Operator review of YG-30286: "what is in the $28 loaded rate? does
-- it include WSIB?" — there was no way to answer because the rate was
-- a single platform_config number. After this migration:
--
--   loaded_per_role = base_wage × (1 + CPP + EI + WSIB + vacation + EHT)
--
-- And the engine computes a weighted-average over the typical 4-person
-- crew composition (2 movers + 1 driver + 1 lead).
--
-- VERIFIED 2026 ONTARIO RATES (citations in payroll-burden.ts):
--   CPP employer:    5.95% on pensionable $3,500 – $73,200 YMPE
--                    (CRA 2026 contribution schedule)
--   EI employer:     2.296% (= 1.4 × employee rate 1.64%) on insurable
--                    earnings up to $65,700
--   WSIB Ontario:    1.23% per $100 average for 2026 (WSIB premium
--                    schedule eff. Jan 1 2026, per operator citation).
--                    NOTE: moving industry classification (NAICS 484
--                    Truck Transportation) typically carries 3-5%
--                    rate group — operator should set the actual
--                    class-G rate for their account.
--   Vacation pay:    4.00% statutory minimum per Ontario ESA
--                    (bumps to 6% after 5 years service)
--   EHT:             0% under small-business $1M payroll exemption
--                    (1.95% above; configurable)
--
-- Total burden multiplier at defaults: 1.13476
--   $22/hr mover × 1.13476 = $24.96/hr loaded
--   $25/hr driver × 1.13476 = $28.37/hr loaded
--   $28/hr lead × 1.13476 = $31.77/hr loaded
--   Weighted-avg (2/1/1) = $27.52/hr loaded
--
-- ON CONFLICT DO NOTHING — never overwrite operator-set values once
-- they exist. This keeps the migration idempotent and safe to re-run.
-- ───────────────────────────────────────────────────────────────────

INSERT INTO platform_config (key, value, description) VALUES
  -- Per-role base wages
  ('crew_pay_rate_mover',  '22', 'Base hourly wage paid to mover role (pre-burden)'),
  ('crew_pay_rate_driver', '25', 'Base hourly wage paid to driver role (pre-burden)'),
  ('crew_pay_rate_lead',   '28', 'Base hourly wage paid to crew lead role (pre-burden)'),
  -- Payroll burden percentages (decimals)
  ('payroll_burden_cpp_pct',      '0.0595',  'CPP employer contribution rate (CRA 2026)'),
  ('payroll_burden_ei_pct',       '0.02296', 'EI employer rate = 1.4× employee (CRA 2026)'),
  ('payroll_burden_wsib_pct',     '0.0123',  'WSIB Ontario 2026 average — moving industry typically higher'),
  ('payroll_burden_vacation_pct', '0.04',    'Vacation pay accrual — Ontario ESA minimum 4%'),
  ('payroll_burden_eht_pct',      '0',       'Employer Health Tax — 0% under $1M payroll exemption')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
