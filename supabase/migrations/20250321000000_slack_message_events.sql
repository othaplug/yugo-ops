-- Realtime fan-out for Slack Events API (single configured channel)
CREATE TABLE IF NOT EXISTS public.slack_message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (channel_id, ts)
);

ALTER TABLE public.slack_message_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read slack_message_events"
  ON public.slack_message_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Inserts only via service role (API routes); no client INSERT policy

CREATE INDEX IF NOT EXISTS idx_slack_msg_events_channel_created
  ON public.slack_message_events (channel_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'slack_message_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.slack_message_events;
  END IF;
END $$;
