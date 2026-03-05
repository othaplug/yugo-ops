-- Add quoted_price column to deliveries (referenced by detail/edit/create forms but never migrated)
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS quoted_price NUMERIC;
