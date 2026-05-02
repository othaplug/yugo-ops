-- Editable White Glove (item-based) pricing defaults
INSERT INTO platform_config (key, value, description) VALUES
  ('white_glove_base_rate', '199', 'Minimum charge for any White Glove delivery'),
  ('white_glove_assembly_rate', '45', 'Per-item assembly charge at delivery'),
  ('white_glove_disassembly_rate', '35', 'Per-item disassembly charge at pickup'),
  ('white_glove_both_assembly_rate', '70', 'Per-item both-way (disassemble + reassemble) charge'),
  ('white_glove_debris_removal_fee', '50', 'Flat debris removal when selected'),
  ('white_glove_guaranteed_window_fee', '75', 'Add-on when client requires a guaranteed narrow delivery window'),
  ('white_glove_dist_free_km', '15', 'Included km before per-km surcharge'),
  ('white_glove_rate_small', '35', 'WG item base rate: small / light'),
  ('white_glove_rate_medium', '65', 'WG item base rate: medium'),
  ('white_glove_rate_large', '120', 'WG item base rate: large'),
  ('white_glove_rate_heavy_appliance', '150', 'WG item base rate: heavy appliance'),
  ('white_glove_rate_extra_heavy', '250', 'WG item base rate: extra heavy'),
  ('white_glove_rate_fragile', '95', 'WG item base rate: fragile / art'),
  ('white_glove_weight_pct_under_50', '0', 'Weight surcharge percent (under_50)'),
  ('white_glove_weight_pct_50_150', '0', 'Weight surcharge percent (50_150)'),
  ('white_glove_weight_pct_150_300', '15', 'Weight surcharge percent (150_300)'),
  ('white_glove_weight_pct_300_500', '35', 'Weight surcharge percent (300_500)'),
  ('white_glove_weight_pct_over_500', '75', 'Weight surcharge percent (over_500)')
ON CONFLICT (key) DO NOTHING;
