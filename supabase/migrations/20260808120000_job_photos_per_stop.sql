-- Per-stop photo scoping for multi-stop deliveries.
--
-- Today job_photos rows carry (job_id, job_type, session_id,
-- checkpoint, category) but no per-stop scope. On a multi-stop
-- delivery like DLV-30389 (Unique Cabinets + Anton's unit → Anthony's
-- Etobicoke drop-off), loading photos from BOTH vendors end up in
-- the same bucket with no way to say "these three photos are
-- Unique Cabinets, these five are Anton's". If cabinets arrive
-- scratched, chain-of-custody by vendor cannot be substantiated
-- from the photo timeline.
--
-- Add a nullable stop_id → delivery_stops(id). Nullable because
-- moves, single-stop deliveries, and existing rows have no stop
-- concept. ON DELETE SET NULL because if a stop is edited/removed
-- we still want to keep the photo for audit; it just becomes an
-- "unscoped" photo on the parent job.

ALTER TABLE public.job_photos
  ADD COLUMN IF NOT EXISTS stop_id UUID REFERENCES public.delivery_stops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_job_photos_stop
  ON public.job_photos (stop_id)
  WHERE stop_id IS NOT NULL;
