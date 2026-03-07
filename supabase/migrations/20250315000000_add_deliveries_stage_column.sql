-- Add missing stage column to deliveries (referenced by portal-data queries but never applied to production)
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS stage TEXT;
