-- Mid-move client SMS: queued rows processed by /api/cron/move-client-sms (no in-process timers on serverless).

CREATE TABLE IF NOT EXISTS public.scheduled_move_client_sms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('en_route_checkin', 'long_unload_checkin')),
  send_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_scheduled_move_client_sms_due
  ON public.scheduled_move_client_sms (status, send_at)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_move_client_sms_move_kind_pending
  ON public.scheduled_move_client_sms (move_id, kind)
  WHERE status = 'pending';

ALTER TABLE public.scheduled_move_client_sms ENABLE ROW LEVEL SECURITY;
