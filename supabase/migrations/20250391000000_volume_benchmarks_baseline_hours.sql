-- Prompt 90 PATCH: baseline_hours for labour delta (standard hours per move size)
-- Used when comparing actual estimated hours to baseline for pricing.

ALTER TABLE public.volume_benchmarks
  ADD COLUMN IF NOT EXISTS baseline_hours NUMERIC;

UPDATE public.volume_benchmarks SET baseline_hours = 3.0 WHERE move_size = 'studio';
UPDATE public.volume_benchmarks SET baseline_hours = 4.0 WHERE move_size = '1br';
UPDATE public.volume_benchmarks SET baseline_hours = 5.5 WHERE move_size = '2br';
UPDATE public.volume_benchmarks SET baseline_hours = 7.0 WHERE move_size = '3br';
UPDATE public.volume_benchmarks SET baseline_hours = 8.5 WHERE move_size = '4br';
UPDATE public.volume_benchmarks SET baseline_hours = 10.0 WHERE move_size = '5br_plus';
UPDATE public.volume_benchmarks SET baseline_hours = 2.0 WHERE move_size = 'partial';
