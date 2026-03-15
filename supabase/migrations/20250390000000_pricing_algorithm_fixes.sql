-- Pricing algorithm audit fixes (Cursor Prompt 90)
-- FIX 1: inventory_warnings on quotes
-- FIX 2: Raise volume_benchmarks max_modifier for heavy moves
-- FIX 4: Labour rate $75, distance_per_km_rate config

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS inventory_warnings JSONB DEFAULT '[]';

-- FIX 2: max_modifier cap (smaller homes have more variance)
UPDATE public.volume_benchmarks SET max_modifier = 1.50 WHERE move_size IN ('studio', '1br', '2br');
UPDATE public.volume_benchmarks SET max_modifier = 1.45 WHERE move_size = '3br';
UPDATE public.volume_benchmarks SET max_modifier = 1.45 WHERE move_size = '4br';
UPDATE public.volume_benchmarks SET max_modifier = 1.40 WHERE move_size = '5br_plus';

-- FIX 4: Labour rate $75/mover-hour
INSERT INTO public.platform_config (key, value, description) VALUES
  ('labour_rate_per_mover_hour', '75', 'Labour component: rate per mover per hour (crew × hours × this rate)')
ON CONFLICT (key) DO UPDATE SET value = '75';

-- FIX 5: Distance surcharge scaling (optional config; code defaults to 10km base, $4/km)
INSERT INTO public.platform_config (key, value, description) VALUES
  ('distance_per_km_rate', '4', 'Surcharge per km after base distance (local moves)'),
  ('distance_base_km_local', '10', 'Free km included before distance surcharge (local moves only)')
ON CONFLICT (key) DO NOTHING;
