-- Actual driven distance and fuel estimates from in-app navigation (crew arrival).
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS actual_distance_km NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_fuel_litres NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_fuel_cost NUMERIC;

COMMENT ON COLUMN public.moves.actual_distance_km IS 'Last navigation-completed driving distance (km) from crew app Mapbox route.';
COMMENT ON COLUMN public.moves.estimated_fuel_litres IS 'Estimated fuel (L) from navigation distance and truck type.';
COMMENT ON COLUMN public.moves.estimated_fuel_cost IS 'Estimated fuel cost (CAD) using configured rate; for margin dashboards.';
