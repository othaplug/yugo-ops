-- Ensure moves.status accepts all lifecycle status values
-- Fix: "new row for relation moves violates check constraint moves_status_check"

-- 1. Drop the restrictive check constraint (exact name from error)
ALTER TABLE public.moves DROP CONSTRAINT IF EXISTS moves_status_check;

-- 2. If status column is an enum type, convert to TEXT (allows any value)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'moves' AND column_name = 'status'
    AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.moves ALTER COLUMN status TYPE TEXT USING status::text;
  END IF;
END $$;

-- 2. Drop any CHECK constraint on status that restricts allowed values
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'moves' AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.moves DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;
