-- Extend platform_users.role to include coordinator and viewer for internal team
ALTER TABLE public.platform_users
  DROP CONSTRAINT IF EXISTS platform_users_role_check;

ALTER TABLE public.platform_users
  ADD CONSTRAINT platform_users_role_check
  CHECK (role IN ('admin', 'manager', 'dispatcher', 'coordinator', 'viewer', 'client'));
