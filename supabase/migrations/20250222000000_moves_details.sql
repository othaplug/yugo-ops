-- Add columns for editable move details
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS scheduled_time TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS arrival_window TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS access_notes TEXT;
