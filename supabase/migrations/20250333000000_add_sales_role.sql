-- Add 'sales' role to platform_users role constraint
ALTER TABLE public.platform_users
  DROP CONSTRAINT IF EXISTS platform_users_role_check;

ALTER TABLE public.platform_users
  ADD CONSTRAINT platform_users_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'dispatcher', 'coordinator', 'viewer', 'sales', 'client', 'crew', 'partner'));
