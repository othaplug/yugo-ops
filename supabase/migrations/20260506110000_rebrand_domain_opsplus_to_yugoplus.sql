-- Domain rebrand: opsplus.co → yugoplus.co
-- Only updates rows that still hold the old default; custom domains are left untouched.

UPDATE public.platform_config
SET value = 'yugoplus.co'
WHERE key = 'public_domain'
  AND value = 'opsplus.co';

UPDATE public.platform_config
SET value = 'notifications@yugoplus.co'
WHERE key = 'notifications_from_email'
  AND value = 'notifications@opsplus.co';
