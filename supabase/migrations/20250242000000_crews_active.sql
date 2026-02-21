-- Add active column to crews for team toggle persistence
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
