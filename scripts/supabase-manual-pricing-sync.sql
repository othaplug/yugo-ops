-- Paste into Supabase Dashboard → SQL Editor → New Query.
-- Fixes live DB when migrations were not applied or pointed at another project.

-- ── 1) base_rates (Essential base / min_crew / hours) ─────────────────────
SELECT move_size, base_price, min_crew, estimated_hours FROM public.base_rates ORDER BY base_price;

UPDATE public.base_rates SET base_price = 449, min_crew = 2, estimated_hours = 3 WHERE move_size = 'studio';
UPDATE public.base_rates SET base_price = 449, min_crew = 2, estimated_hours = 3 WHERE move_size = 'partial';
UPDATE public.base_rates SET base_price = 649, min_crew = 2, estimated_hours = 4 WHERE move_size = '1br';
UPDATE public.base_rates SET base_price = 999, min_crew = 2, estimated_hours = 5 WHERE move_size = '2br';
UPDATE public.base_rates SET base_price = 1399, min_crew = 3, estimated_hours = 7 WHERE move_size = '3br';
UPDATE public.base_rates SET base_price = 1999, min_crew = 4, estimated_hours = 8 WHERE move_size = '4br';
UPDATE public.base_rates SET base_price = 2699, min_crew = 4, estimated_hours = 10 WHERE move_size = '5br_plus';

-- ── 2) Estate supplies (app reads key estate_supplies_by_size JSON, not *_2br) ─
INSERT INTO public.platform_config (key, value) VALUES
  (
    'estate_supplies_by_size',
    '{"studio":120,"partial":120,"1br":160,"2br":240,"3br":420,"4br":660,"5br_plus":850}'
  )
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── 3) Labour benchmark (PRICING_DEBUG benchmark_crew uses volume_benchmarks, not base_rates) ─
UPDATE public.volume_benchmarks SET baseline_crew = 2, baseline_hours = 5.0 WHERE move_size = '2br';

-- ── 4) Verify ───────────────────────────────────────────────────────────
SELECT move_size, base_price, min_crew, estimated_hours FROM public.base_rates ORDER BY base_price;
SELECT key, value FROM public.platform_config WHERE key = 'estate_supplies_by_size';
SELECT move_size, baseline_crew, baseline_hours FROM public.volume_benchmarks ORDER BY move_size;
