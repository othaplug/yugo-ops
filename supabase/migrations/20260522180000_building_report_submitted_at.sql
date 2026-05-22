-- Track when the crew has submitted their post-move building report so the
-- CrewBuildingReportCard doesn't keep re-appearing on the job page after the
-- equipment check (the card's "done" state was local-only and reset on every
-- page mount, so coordinators saw it twice — once after move completion and
-- again after equipment input).

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS building_report_submitted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.moves.building_report_submitted_at IS
  'When the crew submitted the post-move building report. Null = not yet submitted.';
