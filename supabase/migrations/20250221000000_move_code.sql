-- Add move_code column (6 chars max, e.g. MV3343) - unique per move
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS move_code TEXT;

-- Create sequence for generating unique codes
CREATE SEQUENCE IF NOT EXISTS move_code_seq START 1;

-- Backfill existing moves with unique codes (MV0001, MV0002, ...)
DO $$
DECLARE
  r RECORD;
  n INTEGER := 1;
BEGIN
  FOR r IN SELECT id FROM public.moves WHERE move_code IS NULL OR move_code = '' ORDER BY id ASC
  LOOP
    UPDATE public.moves SET move_code = 'MV' || LPAD(n::text, 4, '0') WHERE id = r.id;
    n := n + 1;
  END LOOP;
  IF n > 1 THEN
    PERFORM setval('move_code_seq', n);
  END IF;
END $$;

-- Trigger to auto-set move_code on insert
CREATE OR REPLACE FUNCTION set_move_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.move_code IS NULL OR NEW.move_code = '' THEN
    NEW.move_code := 'MV' || LPAD(nextval('move_code_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_move_code_trigger ON public.moves;
CREATE TRIGGER set_move_code_trigger
  BEFORE INSERT ON public.moves
  FOR EACH ROW EXECUTE FUNCTION set_move_code();
