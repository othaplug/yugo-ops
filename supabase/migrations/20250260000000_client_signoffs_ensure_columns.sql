-- Ensure all client_sign_offs columns exist (fixes schema cache / migration order issues)
-- Run: supabase db push (or supabase migration up)

ALTER TABLE public.client_sign_offs
  ADD COLUMN IF NOT EXISTS signed_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS signed_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS nps_score SMALLINT,
  ADD COLUMN IF NOT EXISTS walkthrough_conducted_by_client BOOLEAN,
  ADD COLUMN IF NOT EXISTS no_issues_during_move BOOLEAN,
  ADD COLUMN IF NOT EXISTS no_damages BOOLEAN,
  ADD COLUMN IF NOT EXISTS walkthrough_completed BOOLEAN,
  ADD COLUMN IF NOT EXISTS crew_conducted_professionally BOOLEAN,
  ADD COLUMN IF NOT EXISTS crew_wore_protection BOOLEAN,
  ADD COLUMN IF NOT EXISTS furniture_reassembled BOOLEAN,
  ADD COLUMN IF NOT EXISTS items_placed_correctly BOOLEAN,
  ADD COLUMN IF NOT EXISTS property_left_clean BOOLEAN,
  ADD COLUMN IF NOT EXISTS client_present_during_unloading BOOLEAN,
  ADD COLUMN IF NOT EXISTS no_property_damage BOOLEAN,
  ADD COLUMN IF NOT EXISTS pre_existing_conditions_noted BOOLEAN,
  ADD COLUMN IF NOT EXISTS claims_process_explained BOOLEAN,
  ADD COLUMN IF NOT EXISTS photos_reviewed_by_client BOOLEAN,
  ADD COLUMN IF NOT EXISTS damage_report_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_triggered BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
  ADD COLUMN IF NOT EXISTS discrepancy_flags JSONB DEFAULT '[]'::jsonb;
