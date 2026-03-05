-- Fix platform_users role constraint to include 'owner'
ALTER TABLE public.platform_users
  DROP CONSTRAINT IF EXISTS platform_users_role_check;

ALTER TABLE public.platform_users
  ADD CONSTRAINT platform_users_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'dispatcher', 'coordinator', 'viewer', 'client', 'crew', 'partner'));

-- Set super admin accounts to 'owner'
UPDATE public.platform_users SET role = 'owner' WHERE email = 'othaplug@gmail.com';
UPDATE public.platform_users SET role = 'owner' WHERE email = 'oche@helloyugo.com';
