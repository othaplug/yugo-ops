-- Coordinator-selected arrival window from quote form (distinct from preferred_time clock value).
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS arrival_window TEXT;
