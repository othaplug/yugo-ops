-- The 2026-05-06 rebrand migration updated public_domain and
-- notifications_from_email but missed company_website, which still pointed at
-- the dead opsplus.co brand. Bring it onto yugoplus.co.

UPDATE public.platform_config
SET value = 'https://www.yugoplus.co'
WHERE key = 'company_website'
  AND value ILIKE '%opsplus%';
