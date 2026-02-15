-- Run this in Supabase Dashboard > SQL Editor if you get "relation platform_users does not exist"
-- Then add your admin with: INSERT INTO platform_users (user_id, email, name, role)
--   SELECT id, email, raw_user_meta_data->>'full_name', 'admin'
--   FROM auth.users WHERE email = 'your-admin@email.com'
--   ON CONFLICT (user_id) DO NOTHING;

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

ALTER TABLE public.platform_users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;
