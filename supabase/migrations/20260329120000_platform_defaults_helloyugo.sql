-- Point stored platform defaults at helloyugo.com / Yugo notification addresses (idempotent).
UPDATE public.platform_config SET value = 'helloyugo.com' WHERE key = 'public_domain' AND value = 'opsplus.co';

UPDATE public.platform_config
SET value = 'notifications@helloyugo.com'
WHERE key = 'notifications_from_email' AND value = 'notifications@opsplus.co';

UPDATE public.platform_config
SET value = 'https://helloyugo.com'
WHERE key = 'company_website' AND (value ILIKE '%opsplus%' OR value = 'https://app.opsplus.co');

UPDATE public.platform_config
SET value = 'support@helloyugo.com'
WHERE key = 'company_email' AND value = 'notifications@opsplus.co';
