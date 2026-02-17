-- Remove status column from move_inventory (no longer needed)
ALTER TABLE public.move_inventory DROP COLUMN IF EXISTS status;
