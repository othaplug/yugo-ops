-- Follow-up tracking columns for the automated quote nurture sequence
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS followup_1_sent TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS followup_2_sent TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS followup_3_sent TIMESTAMPTZ;

-- Index for the cron job queries (status + time-based lookups)
CREATE INDEX IF NOT EXISTS idx_quotes_followup_sent
  ON public.quotes(status, sent_at)
  WHERE followup_1_sent IS NULL OR followup_2_sent IS NULL OR followup_3_sent IS NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_followup_viewed
  ON public.quotes(status, viewed_at)
  WHERE followup_2_sent IS NULL OR followup_3_sent IS NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_expires
  ON public.quotes(expires_at)
  WHERE status NOT IN ('accepted', 'expired');
