-- Repair / baseline: public.photo_surveys and related objects.
-- Idempotent. Use when a linked project was missing 20260426120000 (PostgREST "schema cache" / PGRST205 for photo_surveys).
-- Safe if 20260426120000 already applied (all IF NOT EXISTS or duplicate-safe DO blocks).
-- Triggers PostgREST to reload the schema so the new table is visible immediately.

CREATE TABLE IF NOT EXISTS public.photo_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  from_address TEXT,
  move_size TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'submitted', 'reviewed', 'quoted'
  )),
  photos JSONB NOT NULL DEFAULT '{}'::jsonb,
  special_notes TEXT,
  total_photos INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_analyzed BOOLEAN NOT NULL DEFAULT FALSE,
  ai_suggestions JSONB,
  coordinator_name TEXT,
  coordinator_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS photo_surveys_token_key ON public.photo_surveys (token);
CREATE INDEX IF NOT EXISTS photo_surveys_lead_id_idx ON public.photo_surveys (lead_id);

CREATE TABLE IF NOT EXISTS public.ai_analysis_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.photo_surveys(id) ON DELETE CASCADE,
  analyzed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  photo_count INTEGER,
  suggestion_count INTEGER,
  suggestions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_analysis_log_survey_idx ON public.ai_analysis_log (survey_id, created_at DESC);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS photo_survey_token TEXT,
  ADD COLUMN IF NOT EXISTS photos_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS photos_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS photo_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_photo_survey_token ON public.leads (photo_survey_token) WHERE photo_survey_token IS NOT NULL;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK (status IN (
  'new',
  'assigned',
  'follow_up_sent',
  'awaiting_reply',
  'contacted',
  'qualified',
  'photos_requested',
  'photos_received',
  'quote_sent',
  'follow_up',
  'converted',
  'lost',
  'disqualified',
  'stale'
));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photo-surveys',
  'photo-surveys',
  false,
  12582912,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.photo_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "staff_all_photo_surveys" ON public.photo_surveys
    FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.platform_users pu
        WHERE pu.user_id = auth.uid()
        AND pu.role IN ('owner','admin','manager','coordinator','dispatcher','viewer','sales'))
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.platform_users pu
        WHERE pu.user_id = auth.uid()
        AND pu.role IN ('owner','admin','manager','coordinator','dispatcher','viewer','sales'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff_read_ai_log" ON public.ai_analysis_log
    FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM public.platform_users pu
        WHERE pu.user_id = auth.uid()
        AND pu.role IN ('owner','admin','manager','coordinator','dispatcher','viewer','sales'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff_insert_ai_log" ON public.ai_analysis_log
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.platform_users pu
        WHERE pu.user_id = auth.uid()
        AND pu.role IN ('owner','admin','manager','coordinator','dispatcher','sales'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Platform users read photo-survey storage"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'photo-surveys'
      AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Platform users manage photo-survey storage"
    ON storage.objects FOR ALL TO authenticated
    USING (
      bucket_id = 'photo-surveys'
      AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
    )
    WITH CHECK (
      bucket_id = 'photo-surveys'
      AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'photo_surveys'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_surveys;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
