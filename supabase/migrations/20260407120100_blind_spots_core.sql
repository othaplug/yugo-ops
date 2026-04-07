-- Blind spots Features 1–8: scheduled emails, quote payment_failed, survey, checklist tokens,
-- move modifications, incidents extensions, pre-move reminder idempotency columns.

-- ── scheduled_emails (win-back, payment retry reminders, future types) ──
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  move_id UUID REFERENCES public.moves(id) ON DELETE CASCADE,
  partner_id UUID,
  type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending
  ON public.scheduled_emails (scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_quote_id ON public.scheduled_emails (quote_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_move_id ON public.scheduled_emails (move_id);

ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- ── quotes: payment_failed + comparison alert dedupe ──
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS payment_error TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS payment_retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS comparison_alert_sent_at TIMESTAMPTZ;

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN (
    'draft',
    'sent',
    'viewed',
    'accepted',
    'expired',
    'declined',
    'superseded',
    'reactivated',
    'cold',
    'lost',
    'payment_failed'
  ));

-- ── move_survey_photos + move survey fields ──
CREATE TABLE IF NOT EXISTS public.move_survey_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  room TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_move_survey_photos_move_id ON public.move_survey_photos (move_id);

ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS survey_token TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS survey_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS survey_flags JSONB DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_moves_survey_token
  ON public.moves (survey_token)
  WHERE survey_token IS NOT NULL AND trim(survey_token) <> '';

-- ── client checklist token (extended progress separate from crew pre_move_checklist) ──
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS checklist_token TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS extended_checklist_progress JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_moves_checklist_token
  ON public.moves (checklist_token)
  WHERE checklist_token IS NOT NULL AND trim(checklist_token) <> '';

-- ── pre-move reminder idempotency (Feature 6) ──
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS elevator_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS parking_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS move_prep_checklist_email_sent_at TIMESTAMPTZ;

-- ── move_modifications (Feature 4) ──
CREATE TABLE IF NOT EXISTS public.move_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}',
  original_price NUMERIC,
  new_price NUMERIC,
  price_difference NUMERIC,
  requested_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  client_approval_token TEXT,
  approved_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_move_modifications_move_id ON public.move_modifications (move_id);
CREATE INDEX IF NOT EXISTS idx_move_modifications_status ON public.move_modifications (status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_move_modifications_client_token
  ON public.move_modifications (client_approval_token)
  WHERE client_approval_token IS NOT NULL AND trim(client_approval_token) <> '';

-- ── incidents: crew move-day issues (Feature 8) ──
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS urgency TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_issue_type_check;

ALTER TABLE public.incidents ADD CONSTRAINT incidents_issue_type_check
  CHECK (issue_type IS NOT NULL AND length(trim(issue_type)) > 0);

COMMENT ON COLUMN public.incidents.issue_type IS
  'Machine code: legacy damage|delay|missing_item|access_problem|other or crew codes e.g. client_absent, elevator_unavailable.';

-- Quote engagement: throttled ping for scroll / time-on-page (comparison intelligence)
-- Some remotes never received 20250282000000_quote_engagement_tracking; ensure table exists first.
CREATE TABLE IF NOT EXISTS public.quote_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  session_duration_seconds INTEGER,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_quote ON public.quote_engagement(quote_id);
CREATE INDEX IF NOT EXISTS idx_engagement_type ON public.quote_engagement(event_type);

ALTER TABLE public.quote_engagement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert engagement" ON public.quote_engagement;
CREATE POLICY "Public insert engagement" ON public.quote_engagement FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read engagement" ON public.quote_engagement;
CREATE POLICY "Admins read engagement" ON public.quote_engagement FOR SELECT USING (true);

ALTER TABLE public.quote_engagement DROP CONSTRAINT IF EXISTS quote_engagement_event_type_check;
ALTER TABLE public.quote_engagement ADD CONSTRAINT quote_engagement_event_type_check
  CHECK (event_type IN (
    'page_view',
    'tier_clicked',
    'tier_hovered',
    'addon_toggled',
    'contract_viewed',
    'payment_started',
    'payment_abandoned',
    'comparison_viewed',
    'call_crew_clicked',
    'page_exit',
    'engagement_ping'
  ));
