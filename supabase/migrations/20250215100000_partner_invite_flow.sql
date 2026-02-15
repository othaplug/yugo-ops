-- Partner invite flow: link organizations to auth users
-- Add user_id to organizations (primary contact / login)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- partner_users: links auth user to organization (for partner portal access)
CREATE TABLE IF NOT EXISTS public.partner_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(org_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_users_user_id ON public.partner_users (user_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_org_id ON public.partner_users (org_id);

ALTER TABLE public.partner_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read own partner_users"
  ON public.partner_users FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage partner_users"
  ON public.partner_users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Organizations: allow partners to update their own org (API restricts to contact_name, email, phone)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read organizations"
  ON public.organizations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Partner can update own org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (id IN (SELECT org_id FROM public.partner_users WHERE user_id = auth.uid()))
  WITH CHECK (id IN (SELECT org_id FROM public.partner_users WHERE user_id = auth.uid()));

CREATE POLICY "Platform user can manage organizations"
  ON public.organizations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
