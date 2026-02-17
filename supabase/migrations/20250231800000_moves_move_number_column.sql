-- Ensure move_number column exists; trigger 20250231700000 sets value on insert
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS move_number TEXT;
