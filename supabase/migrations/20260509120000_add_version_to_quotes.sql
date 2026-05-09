-- Add version column to quotes (was referenced in code but never migrated).
-- Defaults to 1 for all existing rows.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
