-- Multi-day residential: crew day checklist JSON, SMS idempotency flags, expandable scheduled SMS kinds, notification_events.

ALTER TABLE public.move_project_days
  ADD COLUMN IF NOT EXISTS crew_day_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS arrival_notice_sent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completion_notice_sent BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.move_project_days.crew_day_state IS 'Crew-managed checklist keyed by operational fields (rooms packed, unpack tasks); JSON shape is app-defined.';

INSERT INTO public.notification_events (event_slug, event_name, description, category, display_order)
VALUES (
  'move_project_day_completed',
  'Multi-day move day completed',
  'Crew marked a residential project day complete',
  'moves',
  55
),
(
  'move_project_day_started',
  'Multi-day move day underway',
  'Crew confirmed on site for a pack, unpack, or prep project day',
  'moves',
  56
)
ON CONFLICT (event_slug) DO NOTHING;
