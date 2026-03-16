-- Add delivery_id, square_invoice_id, and square_invoice_url to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS delivery_id uuid REFERENCES public.deliveries(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS square_invoice_id text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS square_invoice_url text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS line_items jsonb DEFAULT '[]';

CREATE INDEX IF NOT EXISTS invoices_delivery_id_idx ON public.invoices (delivery_id);
CREATE INDEX IF NOT EXISTS invoices_organization_id_idx ON public.invoices (organization_id);
