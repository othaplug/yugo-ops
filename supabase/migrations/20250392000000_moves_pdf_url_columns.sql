-- Store public URLs for auto-generated move documents (Move Summary, Invoice, Receipt)
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS summary_pdf_url TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS invoice_pdf_url TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS receipt_pdf_url TEXT;
