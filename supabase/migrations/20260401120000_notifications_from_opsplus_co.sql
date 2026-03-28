-- Undo supabase/migrations/20260329120001_platform_defaults_helloyugo.sql (pre-launch: opsplus.co).
-- Run via `supabase db push` or SQL Editor if you are locked out before migrations apply.

UPDATE public.platform_config
SET value = 'opsplus.co'
WHERE key = 'public_domain'
  AND value = 'helloyugo.com';

UPDATE public.platform_config
SET value = 'notifications@opsplus.co'
WHERE key = 'notifications_from_email'
  AND value = 'notifications@helloyugo.com';

UPDATE public.platform_config
SET value = 'https://app.opsplus.co'
WHERE key = 'company_website'
  AND value = 'https://helloyugo.com';

UPDATE public.platform_config
SET value = 'notifications@opsplus.co'
WHERE key = 'company_email'
  AND value = 'support@helloyugo.com';
