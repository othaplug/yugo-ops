-- Ensure platform_users exists (fix for "relation does not exist" error)
-- Run: npx supabase db push
-- Or run this SQL manually in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.platform_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'dispatcher' CHECK (role IN ('dispatcher', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_users_user_id ON public.platform_users (user_id);
CREATE INDEX IF NOT EXISTS idx_platform_users_email ON public.platform_users (email);

ALTER TABLE public.platform_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read platform_users" ON public.platform_users;
CREATE POLICY "Authenticated can read platform_users"
  ON public.platform_users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role can manage platform_users" ON public.platform_users;
CREATE POLICY "Service role can manage platform_users"
  ON public.platform_users FOR ALL TO service_role USING (true) WITH CHECK (true);
