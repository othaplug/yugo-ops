-- White Glove: 50km included before distance line; per-km rate beyond that.
-- Supersedes aggressive white_glove_dist_free_km seeds (e.g. 15km) once this key exists.
INSERT INTO platform_config (key, value, description) VALUES
  (
    'white_glove_free_radius_km',
    '50',
    'White Glove: route km with no distance surcharge (takes precedence over white_glove_dist_free_km when this row is present)'
  ),
  (
    'white_glove_distance_rate',
    '2',
    'White Glove: dollars per km beyond the free radius'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;
