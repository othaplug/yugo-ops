-- Add delay_minutes to crews for ETA display when crew is running late
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS delay_minutes INTEGER;
