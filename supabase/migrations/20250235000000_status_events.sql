-- Activity feed for command center (notifications, client messages, payments, etc.)
CREATE TABLE IF NOT EXISTS public.status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_events_created_at ON public.status_events (created_at DESC);

ALTER TABLE public.status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read status_events"
  ON public.status_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert status_events"
  ON public.status_events FOR INSERT TO authenticated WITH CHECK (true);

-- Allow anon for server-side admin client (bypasses RLS with service role)
-- No anon policy needed; admin API uses service role.
