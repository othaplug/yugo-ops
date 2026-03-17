-- Add actual_hours and actual_crew_count to deliveries for profitability labour calculation
-- Written when crew completes tracking session (same as moves)
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS actual_hours NUMERIC;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS actual_crew_count INTEGER;
