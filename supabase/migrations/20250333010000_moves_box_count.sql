-- Add client_box_count to moves (from Prompt 82 inventory expansion)
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS client_box_count INTEGER;
