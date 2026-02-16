-- Ensure moves has client_email and client_name for contact modal and notify
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS client_name TEXT;
