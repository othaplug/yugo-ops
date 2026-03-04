-- Add customer_email to deliveries for partner schedule form and schema cache
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS customer_email TEXT;
