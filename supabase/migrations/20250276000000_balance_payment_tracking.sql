-- Balance payment tracking: dual payment with e-transfer priority / card fallback

ALTER TABLE moves ADD COLUMN IF NOT EXISTS balance_method TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS balance_reminder_72hr_sent TIMESTAMPTZ;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS balance_reminder_48hr_sent TIMESTAMPTZ;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS balance_auto_charged BOOLEAN DEFAULT FALSE;

-- Index for cron queries that look up moves needing balance reminders or charges
CREATE INDEX IF NOT EXISTS idx_moves_balance_pending
  ON moves (scheduled_date)
  WHERE balance_paid_at IS NULL AND deposit_paid_at IS NOT NULL;
