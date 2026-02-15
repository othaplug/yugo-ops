-- Messages table for #ops-inbox (Slack-style threads)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_type TEXT NOT NULL DEFAULT 'client', -- 'admin' | 'client'
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for thread lookups and ordering
CREATE INDEX IF NOT EXISTS idx_messages_thread_created ON public.messages (thread_id, created_at);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admin) to read/write
CREATE POLICY "Authenticated users can manage messages"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon for dev/demo (restrict in production)
CREATE POLICY "Anon can manage messages"
  ON public.messages
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Enable Realtime for new message subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;