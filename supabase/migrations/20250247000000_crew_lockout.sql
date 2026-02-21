-- Crew login lockout: persist failed attempts in DB for multi-instance deployments
CREATE TABLE IF NOT EXISTS public.crew_lockout_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crew_lockout_key ON public.crew_lockout_attempts (key);

-- Platform users can manage (for admin reset)
ALTER TABLE public.crew_lockout_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users manage crew_lockout" ON public.crew_lockout_attempts;
CREATE POLICY "Platform users manage crew_lockout"
  ON public.crew_lockout_attempts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
