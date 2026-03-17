-- Store Square receipt URL on invoices when paid via Square-hosted invoice page
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS square_receipt_url TEXT;
