-- Add delivery_address to moves (destination / to address alias used by notify and UI)
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS delivery_address TEXT;
