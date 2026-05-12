-- Quote follow-up upgrade: move-date urgency, 48h expiry warning, hot-quote alert.
--
-- followup_urgency_sent: marker for the move-date urgency rule. Fires when
--   move_date is ≤ 5 days away AND status is sent/viewed AND not accepted.
--   Independent of the cadence-based F1/F2/F3 chain.
--
-- followup_expiry_sent: marker for the 48h-before-expiry safety net. Fires
--   when expires_at is within 48h regardless of which other follow-ups ran.
--
-- coordinator_alerted_at: dedup for the hot-quote coordinator alert (≥3
--   distinct page_view sessions logged in quote_engagement, no booking).

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS followup_urgency_sent TIMESTAMPTZ;
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS followup_expiry_sent TIMESTAMPTZ;
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS coordinator_alerted_at TIMESTAMPTZ;

-- Index for the move-date urgency query: only candidates with a future
-- move_date that haven't yet been alerted.
CREATE INDEX IF NOT EXISTS idx_quotes_followup_urgency
  ON public.quotes(move_date)
  WHERE followup_urgency_sent IS NULL
    AND status IN ('sent', 'viewed')
    AND move_date IS NOT NULL;

-- Index for the 48h expiry warning sweep.
CREATE INDEX IF NOT EXISTS idx_quotes_followup_expiry_warning
  ON public.quotes(expires_at)
  WHERE followup_expiry_sent IS NULL
    AND status IN ('sent', 'viewed');
