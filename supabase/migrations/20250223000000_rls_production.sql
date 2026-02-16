-- Production RLS: remove anon policies, add policies for core tables
-- Run after all other migrations

-- 1. Remove anon policies (messages, invitations)
DROP POLICY IF EXISTS "Anon can manage messages" ON public.messages;
DROP POLICY IF EXISTS "Anon can manage invitations" ON public.invitations;

-- 2. Enable RLS on tables that may not have it (idempotent)
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;

-- 3. Allow authenticated platform users to manage core data
DROP POLICY IF EXISTS "Platform users can manage moves" ON public.moves;
CREATE POLICY "Platform users can manage moves"
  ON public.moves FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users can manage deliveries" ON public.deliveries;
CREATE POLICY "Platform users can manage deliveries"
  ON public.deliveries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users can manage invoices" ON public.invoices;
CREATE POLICY "Platform users can manage invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users can manage referrals" ON public.referrals;
CREATE POLICY "Platform users can manage referrals"
  ON public.referrals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users can manage realtors" ON public.realtors;
CREATE POLICY "Platform users can manage realtors"
  ON public.realtors FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users can manage crews" ON public.crews;
CREATE POLICY "Platform users can manage crews"
  ON public.crews FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- 4. Service role bypass (for API routes using createAdminClient)
-- RLS does not apply to service_role; no policy needed.
