-- Ensure crews has columns needed for live GPS tracking
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION;
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION;
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
