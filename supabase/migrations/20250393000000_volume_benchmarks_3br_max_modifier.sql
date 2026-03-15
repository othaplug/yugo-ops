-- Prompt 90: 3br should have max_modifier 1.50 (same as studio/1br/2br); was 1.45 in prior migration.
UPDATE public.volume_benchmarks SET max_modifier = 1.50 WHERE move_size = '3br';
