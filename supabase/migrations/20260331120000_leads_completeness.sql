-- Lead completeness paths, smart follow-up metadata, manual inquiry fields.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS completeness_path TEXT NOT NULL DEFAULT 'manual_review',
  ADD COLUMN IF NOT EXISTS completeness_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fields_present JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fields_missing JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS clarifications_needed JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS follow_up_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS follow_up_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_inquiry_text TEXT,
  ADD COLUMN IF NOT EXISTS detected_service_type TEXT,
  ADD COLUMN IF NOT EXISTS detected_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS external_platform TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

DO $$ BEGIN
  ALTER TABLE public.leads ADD CONSTRAINT leads_completeness_path_check
    CHECK (completeness_path IN ('auto_quote', 'needs_info', 'manual_review'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK (status IN (
  'new',
  'assigned',
  'follow_up_sent',
  'awaiting_reply',
  'contacted',
  'qualified',
  'quote_sent',
  'follow_up',
  'converted',
  'lost',
  'disqualified',
  'stale'
));

ALTER TABLE public.lead_activities DROP CONSTRAINT IF EXISTS lead_activities_activity_type_check;

ALTER TABLE public.lead_activities ADD CONSTRAINT lead_activities_activity_type_check CHECK (activity_type IN (
  'created',
  'assigned',
  'viewed',
  'contacted',
  'quote_sent',
  'follow_up_sent',
  'follow_up_scheduled',
  'follow_up_completed',
  'status_changed',
  'note_added',
  'converted',
  'lost'
));
