-- Pricing fixes: base_rates, inventory modifier defaults, estate supplies JSON

UPDATE public.base_rates SET base_price = 449, min_crew = 2, estimated_hours = 3 WHERE move_size = 'studio';
UPDATE public.base_rates SET base_price = 649, min_crew = 2, estimated_hours = 4 WHERE move_size = '1br';
UPDATE public.base_rates SET base_price = 999, min_crew = 2, estimated_hours = 5 WHERE move_size = '2br';
UPDATE public.base_rates SET base_price = 1399, min_crew = 3, estimated_hours = 7 WHERE move_size = '3br';
UPDATE public.base_rates SET base_price = 1999, min_crew = 4, estimated_hours = 8 WHERE move_size = '4br';
UPDATE public.base_rates SET base_price = 2699, min_crew = 4, estimated_hours = 10 WHERE move_size = '5br_plus';
UPDATE public.base_rates SET base_price = 449, min_crew = 2, estimated_hours = 3 WHERE move_size = 'partial';

INSERT INTO platform_config (key, value) VALUES
  ('inventory_modifier_dampening', '0.40'),
  ('inventory_modifier_floor', '0.80'),
  (
    'estate_supplies_by_size',
    '{"studio":120,"partial":120,"1br":160,"2br":240,"3br":420,"4br":660,"5br_plus":850}'
  ),
  (
    'truck_upgrade_step_surcharges',
    '{"sprinter_16ft":50,"16ft_20ft":75,"20ft_24ft":50,"24ft_26ft":50}'
  )
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
