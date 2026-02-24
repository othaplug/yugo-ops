-- Power features for client sign-offs: geolocation, NPS, photo review, damage window, skip tracking, discrepancy flags

-- 1. Geolocation capture
ALTER TABLE public.client_sign_offs
  ADD COLUMN IF NOT EXISTS signed_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS signed_lng DOUBLE PRECISION;

-- 2. NPS score (0-10)
ALTER TABLE public.client_sign_offs
  ADD COLUMN IF NOT EXISTS nps_score SMALLINT CHECK (nps_score IS NULL OR (nps_score >= 0 AND nps_score <= 10));

-- 3. Additional confirmation checkboxes
ALTER TABLE public.client_sign_offs
  ADD COLUMN IF NOT EXISTS crew_wore_protection BOOLEAN,
  ADD COLUMN IF NOT EXISTS furniture_reassembled BOOLEAN,
  ADD COLUMN IF NOT EXISTS items_placed_correctly BOOLEAN,
  ADD COLUMN IF NOT EXISTS property_left_clean BOOLEAN,
  ADD COLUMN IF NOT EXISTS client_present_during_unloading BOOLEAN,
  ADD COLUMN IF NOT EXISTS no_property_damage BOOLEAN,
  ADD COLUMN IF NOT EXISTS pre_existing_conditions_noted BOOLEAN,
  ADD COLUMN IF NOT EXISTS claims_process_explained BOOLEAN,
  ADD COLUMN IF NOT EXISTS photos_reviewed_by_client BOOLEAN;

-- 4. Time-limited damage reporting window
ALTER TABLE public.client_sign_offs
  ADD COLUMN IF NOT EXISTS damage_report_deadline TIMESTAMPTZ;

-- 5. Escalation flags
ALTER TABLE public.client_sign_offs
  ADD COLUMN IF NOT EXISTS escalation_triggered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT;

-- 6. Discrepancy flags (set by background check after EOD)
ALTER TABLE public.client_sign_offs
  ADD COLUMN IF NOT EXISTS discrepancy_flags JSONB DEFAULT '[]'::jsonb;

-- 7. Skip tracking table
CREATE TABLE IF NOT EXISTS public.signoff_skips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('move', 'delivery')),
  team_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  crew_member_id UUID REFERENCES public.crew_members(id) ON DELETE SET NULL,
  skip_reason TEXT NOT NULL CHECK (skip_reason IN (
    'client_not_home',
    'client_refused',
    'client_requested_delay',
    'emergency',
    'other'
  )),
  skip_note TEXT,
  photo_storage_path TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_signoff_skips_job ON public.signoff_skips (job_id, job_type);
CREATE INDEX IF NOT EXISTS idx_signoff_skips_team ON public.signoff_skips (team_id);

ALTER TABLE public.signoff_skips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform users manage signoff_skips" ON public.signoff_skips;
CREATE POLICY "Platform users manage signoff_skips"
  ON public.signoff_skips FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
