-- Extend invitations for invite flow with temp password
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS temp_password TEXT;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Platform users: links auth.users to role (only admin can change)
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

CREATE POLICY "Authenticated can read platform_users"
  ON public.platform_users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage platform_users"
  ON public.platform_users FOR ALL TO service_role USING (true) WITH CHECK (true);
