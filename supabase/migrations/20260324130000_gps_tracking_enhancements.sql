-- Crew GPS offline alerts + optional source on location breadcrumbs
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS gps_alert_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE public.location_updates ADD COLUMN IF NOT EXISTS source TEXT;

COMMENT ON COLUMN public.location_updates.source IS 'foreground | background | service_worker (queued retry)';
