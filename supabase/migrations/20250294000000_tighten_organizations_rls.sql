-- Tighten organizations RLS: only platform users can read all orgs,
-- partners can only read their own org.
-- Replaces the overly permissive "Authenticated can read organizations" policy.

DO $$
BEGIN
  -- Drop the old overly-permissive policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizations'
      AND policyname = 'Authenticated can read organizations'
  ) THEN
    DROP POLICY "Authenticated can read organizations" ON public.organizations;
  END IF;
END $$;

-- Platform users (admins/staff) can read all organizations
CREATE POLICY "Platform users can read all organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE platform_users.user_id = auth.uid()
    )
  );

-- Partners can read only their own organization
CREATE POLICY "Partners can read own organization"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT org_id FROM public.partner_users
      WHERE partner_users.user_id = auth.uid()
    )
  );
