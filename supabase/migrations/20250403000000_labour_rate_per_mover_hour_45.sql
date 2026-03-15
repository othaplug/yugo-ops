-- Labour rate: incremental rate for extra man-hours above baseline (not full billable rate)
UPDATE public.platform_config
SET value = '45', description = 'Labour component: incremental rate per mover per hour for extra man-hours above baseline (crew × hours × this rate)'
WHERE key = 'labour_rate_per_mover_hour';

-- If row doesn't exist (e.g. fresh DB), insert
INSERT INTO public.platform_config (key, value, description)
VALUES ('labour_rate_per_mover_hour', '45', 'Labour component: incremental rate per mover per hour for extra man-hours above baseline (crew × hours × this rate)')
ON CONFLICT (key) DO UPDATE SET value = '45', description = EXCLUDED.description;
