-- ══════════════════════════════════════════════════
-- Role Gating & Audit Logging (Prompts 54 + 55)
-- ══════════════════════════════════════════════════

-- Extend platform_users role to include 'owner'
ALTER TABLE public.platform_users
  DROP CONSTRAINT IF EXISTS platform_users_role_check;

ALTER TABLE public.platform_users
  ADD CONSTRAINT platform_users_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'dispatcher', 'coordinator', 'viewer', 'client', 'crew', 'partner'));

-- Set the primary account to 'owner'
UPDATE public.platform_users
  SET role = 'owner'
  WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'oche@helloyugo.com' LIMIT 1
  );

-- ── Audit Log ──

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_time ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_read_audit" ON public.audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.platform_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "anyone_insert_audit" ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- ── RLS for pricing tables (owner/admin only) ──
-- These tables already have RLS enabled with permissive policies;
-- add restrictive read policies scoped to owner/admin.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pricing_admin_only_base_rates') THEN
    CREATE POLICY "pricing_admin_only_base_rates" ON public.base_rates FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pricing_admin_only_neighbourhood_tiers') THEN
    CREATE POLICY "pricing_admin_only_neighbourhood_tiers" ON public.neighbourhood_tiers FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pricing_admin_only_platform_config') THEN
    CREATE POLICY "pricing_admin_only_platform_config" ON public.platform_config FOR ALL
      USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
  END IF;
END $$;
