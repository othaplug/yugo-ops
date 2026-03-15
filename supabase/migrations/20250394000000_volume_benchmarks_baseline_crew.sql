-- Prompt 89: Add baseline_crew for labour delta (baseline man-hours = baseline_crew × baseline_hours)
-- Ensure both columns exist (baseline_hours may exist from 20250391000000 on some envs).

ALTER TABLE public.volume_benchmarks
  ADD COLUMN IF NOT EXISTS baseline_crew INTEGER DEFAULT 2;

ALTER TABLE public.volume_benchmarks
  ADD COLUMN IF NOT EXISTS baseline_hours NUMERIC;

UPDATE public.volume_benchmarks SET baseline_crew = 2, baseline_hours = 3.0  WHERE move_size = 'studio';
UPDATE public.volume_benchmarks SET baseline_crew = 2, baseline_hours = 4.0  WHERE move_size = '1br';
UPDATE public.volume_benchmarks SET baseline_crew = 3, baseline_hours = 5.5 WHERE move_size = '2br';
UPDATE public.volume_benchmarks SET baseline_crew = 3, baseline_hours = 7.0 WHERE move_size = '3br';
UPDATE public.volume_benchmarks SET baseline_crew = 4, baseline_hours = 8.5 WHERE move_size = '4br';
UPDATE public.volume_benchmarks SET baseline_crew = 4, baseline_hours = 10.0 WHERE move_size = '5br_plus';
UPDATE public.volume_benchmarks SET baseline_crew = 2, baseline_hours = 2.0  WHERE move_size = 'partial';
