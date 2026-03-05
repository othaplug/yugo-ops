-- Ensure moves.amount exists (schema cache / create-move insert)
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS amount NUMERIC;
