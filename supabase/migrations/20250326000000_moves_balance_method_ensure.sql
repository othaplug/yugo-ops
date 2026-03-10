-- Ensure balance payment tracking columns exist on moves (schema cache / missing migration fix)
ALTER TABLE moves ADD COLUMN IF NOT EXISTS balance_method TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS balance_reminder_72hr_sent TIMESTAMPTZ;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS balance_reminder_48hr_sent TIMESTAMPTZ;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS balance_auto_charged BOOLEAN DEFAULT FALSE;
