-- Add special_handling to deliveries for "Special Handling Required" tag
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS special_handling BOOLEAN NOT NULL DEFAULT false;
