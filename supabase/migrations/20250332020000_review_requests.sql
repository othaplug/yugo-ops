-- ══════════════════════════════════════════════════
-- Review requests: table + platform config
-- ══════════════════════════════════════════════════

-- Platform config for Google review URL and feature toggle
INSERT INTO public.platform_config (key, value, description) VALUES
  ('google_review_url', 'https://g.page/r/yugo-moving/review', 'Direct link to leave a Google review for Yugo'),
  ('auto_review_requests', 'true', 'Automatically send Google review requests 2 hours after moves complete')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- Review requests table
CREATE TABLE IF NOT EXISTS public.review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  tier TEXT,

  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'reminded', 'reviewed', 'skipped'
  )),

  email_sent_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  review_clicked BOOLEAN DEFAULT FALSE,
  review_clicked_at TIMESTAMPTZ,

  pod_rating INTEGER,

  scheduled_send_at TIMESTAMPTZ NOT NULL,
  reminder_send_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_requests_move_id ON public.review_requests(move_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_status_scheduled ON public.review_requests(status, scheduled_send_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_review_requests_reminder ON public.review_requests(status, reminder_send_at) WHERE status = 'sent';

ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
