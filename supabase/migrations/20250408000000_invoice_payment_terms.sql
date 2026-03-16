-- Add invoice payment terms to organizations (B2B partners).
-- invoice_due_days: 15 or 30 days from invoice date (Net 15 / Net 30)
-- invoice_due_day_of_month: 15 or 30 = due on that day of month (e.g. 15th or 30th)

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS invoice_due_days INTEGER DEFAULT 30;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS invoice_due_day_of_month INTEGER;

-- Constrain to valid values
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS chk_invoice_due_days;
ALTER TABLE public.organizations ADD CONSTRAINT chk_invoice_due_days
  CHECK (invoice_due_days IS NULL OR invoice_due_days IN (15, 30));

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS chk_invoice_due_day_of_month;
ALTER TABLE public.organizations ADD CONSTRAINT chk_invoice_due_day_of_month
  CHECK (invoice_due_day_of_month IS NULL OR invoice_due_day_of_month IN (15, 30));

COMMENT ON COLUMN public.organizations.invoice_due_days IS 'Invoice due in N days (15 or 30). Used when invoice_due_day_of_month is null.';
COMMENT ON COLUMN public.organizations.invoice_due_day_of_month IS 'Invoice due on day of month (15 or 30). If set, overrides invoice_due_days.';
