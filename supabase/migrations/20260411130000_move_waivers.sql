-- On-site risk waivers: crew documents condition; client signs or declines before proceeding.

CREATE TABLE IF NOT EXISTS public.move_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  item_name TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  crew_recommendation TEXT CHECK (
    crew_recommendation IS NULL OR crew_recommendation IN ('proceed_with_caution', 'do_not_recommend')
  ),
  reported_by UUID REFERENCES public.crew_members(id) ON DELETE SET NULL,
  reported_by_name TEXT,
  status TEXT NOT NULL DEFAULT 'signed' CHECK (status IN ('signed', 'declined')),
  signature_data TEXT,
  signed_by TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_move_waivers_move_created
  ON public.move_waivers (move_id, created_at DESC);

COMMENT ON TABLE public.move_waivers IS 'Client-signed or declined on-site risk waivers; photo_urls are storage paths in job-photos bucket.';

ALTER TABLE public.move_waivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users read move waivers" ON public.move_waivers;
CREATE POLICY "Platform users read move waivers"
  ON public.move_waivers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()
    )
  );
