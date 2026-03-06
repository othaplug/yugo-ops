-- Remove restrictive status check constraint from deliveries
-- Mirrors the approach used for moves in 20250233000000_moves_status_constraint.sql

ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'status'
    AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.deliveries ALTER COLUMN status TYPE TEXT USING status::text;
  END IF;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT c.conname FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'deliveries' AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;
