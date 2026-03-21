-- Keys used by quote generator + Platform Settings (move-type pricing)
INSERT INTO public.platform_config (key, value, description) VALUES
  ('event_setup_fee_fullday', '1000', 'Event: full-day setup fee (when setup hours = full day)'),
  ('specialty_crating_per_piece', '300', 'Specialty: add-on per custom crating piece'),
  ('specialty_climate_surcharge', '150', 'Specialty: climate-controlled transport surcharge'),
  ('specialty_minimum_price', '500', 'Specialty: minimum quote subtotal before tax'),
  ('white_glove_declared_value_threshold', '5000', 'White glove: declared value above this adds premium'),
  ('white_glove_declared_value_premium', '50', 'White glove: flat premium when declared value exceeds threshold'),
  ('white_glove_minimum_price', '250', 'White glove: minimum subtotal before tax'),
  ('specialty_project_base_prices', '{}', 'JSON map: project_type → base $ (merges with code defaults)'),
  ('specialty_equipment_surcharges', '{}', 'JSON map: equipment label → surcharge $ (merges with code defaults)')
ON CONFLICT (key) DO NOTHING;
