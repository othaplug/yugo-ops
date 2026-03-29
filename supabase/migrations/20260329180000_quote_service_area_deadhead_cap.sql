-- Service area postal prefixes + deadhead cap (quote safety)
INSERT INTO public.platform_config (key, value, description)
SELECT 'max_deadhead_km', '100', 'Cap deadhead km for surcharge/mobilization; actual distance stored separately on quote factors.'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_config WHERE key = 'max_deadhead_km');

INSERT INTO public.platform_config (key, value, description)
SELECT 'service_area_primary_prefixes', '["M","L"]', 'JSON array: first letter of Canadian FSA for primary (GTA) service area.'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_config WHERE key = 'service_area_primary_prefixes');

INSERT INTO public.platform_config (key, value, description)
SELECT 'service_area_extended_prefixes', '["K","N"]', 'JSON array: extended Southern Ontario FSAs (long-distance pricing may apply).'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_config WHERE key = 'service_area_extended_prefixes');

INSERT INTO public.platform_config (key, value, description)
SELECT 'service_area_max_radius_km', '100', 'Optional reference radius from Toronto base; primary classification uses postal prefixes.'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_config WHERE key = 'service_area_max_radius_km');
