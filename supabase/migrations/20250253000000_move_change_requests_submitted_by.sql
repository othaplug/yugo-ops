-- Only show notification dot for client-submitted change requests.
-- submitted_by: 'client' = from track page or client portal; 'admin' = internal/admin-created (future).
ALTER TABLE public.move_change_requests
  ADD COLUMN IF NOT EXISTS submitted_by TEXT NOT NULL DEFAULT 'client'
  CHECK (submitted_by IN ('client', 'admin'));

CREATE INDEX IF NOT EXISTS idx_move_change_requests_pending_client
  ON public.move_change_requests (status, submitted_by)
  WHERE status = 'pending' AND submitted_by = 'client';

COMMENT ON COLUMN public.move_change_requests.submitted_by IS 'Who submitted: client (track/portal) or admin (internal). Dot only for client.';
