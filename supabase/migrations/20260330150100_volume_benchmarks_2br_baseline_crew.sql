-- Align 2BR labour benchmark with base_rates (min_crew 2, ~5h). Essential pricing reads
-- benchmark_crew from volume_benchmarks, not base_rates.
UPDATE public.volume_benchmarks
SET baseline_crew = 2, baseline_hours = 5.0
WHERE move_size = '2br';
