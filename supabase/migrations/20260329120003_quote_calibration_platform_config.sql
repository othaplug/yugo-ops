-- Quote calibration: margin flag bands + pricing engine platform_config defaults

ALTER TABLE moves DROP CONSTRAINT IF EXISTS moves_margin_flag_check;
ALTER TABLE moves ADD CONSTRAINT moves_margin_flag_check
  CHECK (margin_flag IS NULL OR margin_flag IN ('green', 'yellow', 'orange', 'red'));

COMMENT ON COLUMN moves.margin_flag IS 'green >=35%, yellow 25-34%, orange 15-24%, red <15%';

INSERT INTO platform_config (key, value) VALUES
  ('expected_score_studio', '12'),
  ('expected_score_partial', '12'),
  ('expected_score_1br', '28'),
  ('expected_score_2br', '45'),
  ('expected_score_3br', '65'),
  ('expected_score_4br', '90'),
  ('expected_score_5br_plus', '120'),
  ('inventory_modifier_floor', '0.78'),
  ('inventory_modifier_ceiling', '1.25'),
  ('inventory_modifier_dampening', '0.50'),
  ('inventory_modifier_dead_zone', '0.20'),
  ('crew_loaded_hourly_rate', '28'),
  ('truck_daily_cost_sprinter', '85'),
  ('truck_daily_cost_16ft', '100'),
  ('truck_daily_cost_20ft', '115'),
  ('truck_daily_cost_24ft', '115'),
  ('truck_daily_cost_26ft', '135'),
  ('avg_moves_per_truck_per_day', '1.5'),
  ('fuel_price_per_litre', '1.65'),
  ('avg_deadhead_km', '15'),
  ('margin_critical_threshold', '15'),
  ('margin_low_threshold', '25'),
  ('margin_warning_threshold', '35')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

UPDATE platform_config SET value = '80' WHERE key = 'labour_only_rate';
