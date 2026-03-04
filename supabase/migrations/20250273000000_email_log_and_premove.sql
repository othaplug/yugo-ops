-- email_log table for tracking all outbound emails
CREATE TABLE IF NOT EXISTS public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  subject TEXT,
  template TEXT,
  resend_id TEXT,
  status TEXT DEFAULT 'sent',
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON public.email_log(recipient);
CREATE INDEX IF NOT EXISTS idx_email_log_template ON public.email_log(template);
CREATE INDEX IF NOT EXISTS idx_email_log_created ON public.email_log(created_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_email_log') THEN
    CREATE POLICY service_role_email_log ON public.email_log FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Pre-move email tracking columns
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS pre_move_72hr_sent TIMESTAMPTZ;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS pre_move_24hr_sent TIMESTAMPTZ;

-- Post-move review tracking
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS review_request_sent TIMESTAMPTZ;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS nps_score INTEGER;

-- Crew details for pre-move emails
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS crew_size INTEGER;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS truck_info TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS arrival_window TEXT;

-- completed_at column (must exist before index — cron needs it)
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Index for cron job queries
CREATE INDEX IF NOT EXISTS idx_moves_scheduled_status
  ON public.moves(scheduled_date, status)
  WHERE status IN ('confirmed', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_moves_completed
  ON public.moves(completed_at, status)
  WHERE status = 'completed';
