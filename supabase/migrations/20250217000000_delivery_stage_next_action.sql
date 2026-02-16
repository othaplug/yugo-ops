-- Add stage and next_action to deliveries for move detail editing
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS next_action TEXT;
