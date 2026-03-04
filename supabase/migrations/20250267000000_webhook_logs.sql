-- Webhook logs table for debugging inbound webhooks (HubSpot, Square, etc.)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  event_type TEXT,
  payload JSONB,
  status TEXT DEFAULT 'received',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON public.webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON public.webhook_logs(created_at DESC);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can read webhook_logs" ON public.webhook_logs;
CREATE POLICY "Platform users can read webhook_logs"
  ON public.webhook_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
