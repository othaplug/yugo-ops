-- Run this in Supabase Dashboard → SQL Editor to fix "platform_users_role_check" error.
-- This allows role = 'client' and 'manager' in addition to 'admin' and 'dispatcher'.

-- 1) Drop the existing role check constraint (any name)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'public.platform_users'::regclass
      AND c.contype = 'c'
      AND a.attname = 'role'
  ) LOOP
    EXECUTE format('ALTER TABLE public.platform_users DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- 2) Add the new constraint allowing all four roles
ALTER TABLE public.platform_users
  ADD CONSTRAINT platform_users_role_check
  CHECK (role IN ('admin', 'manager', 'dispatcher', 'client'));
