-- Cursor Prompt 90 + PATCH: Final pricing algorithm state
-- Safe to run multiple times (idempotent).

-- FIX 2: Inventory modifier cap — heavier moves get more headroom
UPDATE public.volume_benchmarks SET max_modifier = 1.50 WHERE move_size = 'studio';
UPDATE public.volume_benchmarks SET max_modifier = 1.50 WHERE move_size = '1br';
UPDATE public.volume_benchmarks SET max_modifier = 1.50 WHERE move_size = '2br';
UPDATE public.volume_benchmarks SET max_modifier = 1.50 WHERE move_size = '3br';
UPDATE public.volume_benchmarks SET max_modifier = 1.45 WHERE move_size = '4br';
UPDATE public.volume_benchmarks SET max_modifier = 1.40 WHERE move_size = '5br_plus';

-- PATCH: Baseline hours for labour delta (standard hours per move size)
UPDATE public.volume_benchmarks SET baseline_hours = 3.0  WHERE move_size = 'studio';
UPDATE public.volume_benchmarks SET baseline_hours = 4.0  WHERE move_size = '1br';
UPDATE public.volume_benchmarks SET baseline_hours = 5.5  WHERE move_size = '2br';
UPDATE public.volume_benchmarks SET baseline_hours = 7.0  WHERE move_size = '3br';
UPDATE public.volume_benchmarks SET baseline_hours = 8.5  WHERE move_size = '4br';
UPDATE public.volume_benchmarks SET baseline_hours = 10.0 WHERE move_size = '5br_plus';
UPDATE public.volume_benchmarks SET baseline_hours = 2.0  WHERE move_size = 'partial';

-- FIX 4: Labour rate $75/mover-hour
INSERT INTO public.platform_config (key, value, description) VALUES
  ('labour_rate_per_mover_hour', '75', 'Labour component: rate per mover per hour (crew × hours × this rate)')
ON CONFLICT (key) DO UPDATE SET value = '75';

-- FIX 5: Distance surcharge per km (scales with distance; base 10km local)
INSERT INTO public.platform_config (key, value, description) VALUES
  ('distance_per_km_rate', '4', 'Surcharge per km after 10km base distance'),
  ('distance_base_km_local', '10', 'Free km included before distance surcharge (local moves only)')
ON CONFLICT (key) DO NOTHING;
