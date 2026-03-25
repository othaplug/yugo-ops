-- In-app navigation: extra breadcrumb fields + crew_locations summary for dispatch map

ALTER TABLE public.location_updates ADD COLUMN IF NOT EXISTS eta_seconds INTEGER;
ALTER TABLE public.location_updates ADD COLUMN IF NOT EXISTS distance_remaining_meters INTEGER;
ALTER TABLE public.location_updates ADD COLUMN IF NOT EXISTS is_navigating BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.location_updates.source IS 'foreground | background | service_worker (queued retry) | navigation';

ALTER TABLE public.crew_locations ADD COLUMN IF NOT EXISTS nav_eta_seconds INTEGER;
ALTER TABLE public.crew_locations ADD COLUMN IF NOT EXISTS nav_distance_remaining_m INTEGER;
ALTER TABLE public.crew_locations ADD COLUMN IF NOT EXISTS is_navigating BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.crew_locations.nav_eta_seconds IS 'Last reported ETA to active nav destination (seconds), from crew navigation';
COMMENT ON COLUMN public.crew_locations.nav_distance_remaining_m IS 'Last reported distance remaining on route (meters)';
COMMENT ON COLUMN public.crew_locations.is_navigating IS 'True when crew last posted with navigation source / is_navigating';
