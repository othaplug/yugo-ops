-- Incidents: crew-reported issues (damage, delay, access problem, etc.)
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('move', 'delivery')),
  session_id UUID REFERENCES public.tracking_sessions(id) ON DELETE SET NULL,
  crew_member_id UUID REFERENCES public.crew_members(id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('damage', 'delay', 'missing_item', 'access_problem', 'other')),
  description TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_job ON public.incidents (job_id, job_type);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON public.incidents (created_at DESC);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform users manage incidents" ON public.incidents;
CREATE POLICY "Platform users manage incidents"
  ON public.incidents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
