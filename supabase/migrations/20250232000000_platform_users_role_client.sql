-- Allow 'manager' and 'client' in platform_users.role (fix for platform_users_role_check).
-- Run: npx supabase db push
-- Or run the ALTER statements below in Supabase Dashboard > SQL Editor.
ALTER TABLE public.platform_users
  DROP CONSTRAINT IF EXISTS platform_users_role_check;

ALTER TABLE public.platform_users
  ADD CONSTRAINT platform_users_role_check
  CHECK (role IN ('admin', 'manager', 'dispatcher', 'client'));
