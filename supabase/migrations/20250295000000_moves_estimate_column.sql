-- Add estimate column to moves for create-move form and UI (keeps amount as source of truth; estimate mirrors it for display)
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS estimate NUMERIC;
