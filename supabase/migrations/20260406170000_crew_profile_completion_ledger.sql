-- Idempotency for crew profile updates after job completion (checkpoint vs signoff vs admin).
CREATE TABLE IF NOT EXISTS public.crew_profile_job_completion (
  job_type TEXT NOT NULL CHECK (job_type IN ('move', 'delivery')),
  job_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_type, job_id)
);

ALTER TABLE public.crew_profile_job_completion ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_crew_profile_job_completion"
    ON public.crew_profile_job_completion FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One-time tip → profile rollup (split across crew) must not double-apply.
CREATE TABLE IF NOT EXISTS public.crew_profile_tip_applied (
  tip_id UUID PRIMARY KEY REFERENCES public.tips(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crew_profile_tip_applied ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_crew_profile_tip_applied"
    ON public.crew_profile_tip_applied FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- `crew_profiles.user_id` keys `crew_members.id` (PIN portal), not `auth.users`.
ALTER TABLE public.crew_profiles DROP CONSTRAINT IF EXISTS crew_profiles_user_id_fkey;

ALTER TABLE public.crew_profiles
  ADD CONSTRAINT crew_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.crew_members(id) ON DELETE CASCADE;
