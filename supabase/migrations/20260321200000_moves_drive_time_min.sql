-- Route driving time (minutes) from Mapbox — used by POST /api/admin/moves/create
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS drive_time_min INTEGER;
