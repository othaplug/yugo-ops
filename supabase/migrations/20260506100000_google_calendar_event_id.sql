-- Google Calendar event IDs stored on moves and deliveries so events can be
-- updated or deleted when jobs change (reschedule, cancel, etc.).
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS gcal_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_moves_gcal_event_id ON public.moves(gcal_event_id)
  WHERE gcal_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_gcal_event_id ON public.deliveries(gcal_event_id)
  WHERE gcal_event_id IS NOT NULL;
