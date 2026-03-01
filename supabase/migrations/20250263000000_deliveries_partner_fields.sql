-- Add partner-facing fields to deliveries for parity with create-move flow
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_window TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS instructions TEXT;
