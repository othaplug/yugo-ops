-- Add crew_id to recurring_delivery_schedules so admin can assign a default team.
-- Generated deliveries will inherit this crew_id when created.

ALTER TABLE public.recurring_delivery_schedules
  ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_crew
  ON public.recurring_delivery_schedules (crew_id);

COMMENT ON COLUMN public.recurring_delivery_schedules.crew_id IS 'Default crew/team assigned to this recurring schedule. Applied to generated deliveries.';
