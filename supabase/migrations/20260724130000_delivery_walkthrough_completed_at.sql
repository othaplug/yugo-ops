-- Add a persisted completion timestamp to deliveries so the crew app's
-- inventory walkthrough on delivery jobs stops re-prompting after the
-- crew has done it. Moves already had `walkthrough_completed_at`; this
-- brings deliveries to parity so the GET can return it and the client
-- sync effect can flip its local flag to true after a re-mount.
--
-- Nullable — a NULL value means "not yet completed" (same convention as
-- moves.walkthrough_completed_at). No backfill needed.

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS walkthrough_completed_at TIMESTAMPTZ;
