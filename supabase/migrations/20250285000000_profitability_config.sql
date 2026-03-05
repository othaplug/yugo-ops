-- ══════════════════════════════════════════════════
-- Profitability Configuration + Actual Hours Tracking
-- ══════════════════════════════════════════════════

-- Cost config entries
INSERT INTO public.platform_config (key, value, description) VALUES
  ('crew_hourly_cost', '25', 'What Yugo pays crew per hour (not client rate)'),
  ('fuel_cost_per_km', '0.35', 'Fuel cost per kilometer (round trip factored in)'),
  ('truck_daily_cost_sprinter', '60', 'Daily operating cost: Sprinter van'),
  ('truck_daily_cost_16ft', '90', 'Daily operating cost: 16ft truck'),
  ('truck_daily_cost_20ft', '110', 'Daily operating cost: 20ft truck'),
  ('truck_daily_cost_24ft', '130', 'Daily operating cost: 24ft truck'),
  ('truck_daily_cost_26ft', '150', 'Daily operating cost: 26ft truck'),
  ('supplies_cost_studio', '20', 'Supplies estimate: studio move'),
  ('supplies_cost_1br', '30', 'Supplies estimate: 1BR move'),
  ('supplies_cost_2br', '45', 'Supplies estimate: 2BR move'),
  ('supplies_cost_3br', '60', 'Supplies estimate: 3BR move'),
  ('supplies_cost_4br', '80', 'Supplies estimate: 4BR move'),
  ('supplies_cost_5br_plus', '100', 'Supplies estimate: 5BR+ move'),
  ('supplies_cost_office', '120', 'Supplies estimate: office move'),
  ('supplies_cost_single_item', '10', 'Supplies estimate: single item'),
  ('payment_processing_pct', '0.029', 'CC processing percentage'),
  ('payment_processing_flat', '0.30', 'CC processing flat fee per txn'),
  ('monthly_software_cost', '250', 'Monthly software costs'),
  ('monthly_auto_insurance', '1000', 'Monthly commercial auto insurance'),
  ('monthly_gl_insurance', '300', 'Monthly general liability insurance'),
  ('monthly_marketing_budget', '1000', 'Monthly marketing spend'),
  ('monthly_office_admin', '350', 'Monthly office/admin costs'),
  ('monthly_owner_draw', '0', 'Monthly owner compensation (set by owner)'),
  ('target_gross_margin_pct', '40', 'Target gross margin % — alerts below this')
ON CONFLICT (key) DO NOTHING;

-- Actual hours tracking on moves
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS actual_hours NUMERIC;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS actual_crew_count INTEGER;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS actual_start_time TIMESTAMPTZ;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS actual_end_time TIMESTAMPTZ;
