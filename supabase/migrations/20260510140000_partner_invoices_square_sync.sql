-- Partner invoices: Square sync columns + due_date for billing-cycle invoices
--
-- Adds the columns the new POST /api/admin/partners/:partnerId/generate-invoice
-- endpoint needs to sync each partner_invoices row to a real Square invoice.
--
-- due_date            — when the partner must pay (15th or 30th billing cycle)
-- square_invoice_id   — Square's invoice UUID
-- square_invoice_url  — public-pay URL Square emails to the partner

ALTER TABLE public.partner_invoices
  ADD COLUMN IF NOT EXISTS due_date            date,
  ADD COLUMN IF NOT EXISTS square_invoice_id   text,
  ADD COLUMN IF NOT EXISTS square_invoice_url  text;

CREATE INDEX IF NOT EXISTS partner_invoices_due_date_idx
  ON public.partner_invoices (due_date);

CREATE UNIQUE INDEX IF NOT EXISTS partner_invoices_square_id_uniq
  ON public.partner_invoices (square_invoice_id)
  WHERE square_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.partner_invoices.due_date           IS 'When the partner is due to pay (15th of current month if generated before 15th, else 30th)';
COMMENT ON COLUMN public.partner_invoices.square_invoice_id  IS 'Square Invoice ID — populated when invoice is sent via Square';
COMMENT ON COLUMN public.partner_invoices.square_invoice_url IS 'Public-pay URL from Square — used in admin + partner portal links';
