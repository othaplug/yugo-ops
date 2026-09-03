-- Delivery signoff sticky state, parallel to walkthrough_completed_at.
--
-- Populated on BOTH paths: the signed-signoff path (client_sign_offs
-- insert) and the crew skip path (signoff_skips insert). The crew
-- signoff UI reads this column as the source of truth for "already
-- signed" instead of live-querying client_sign_offs, so a transient
-- read miss (or the entity-id mismatch between POST and GET at
-- signoff/[jobId]/route.ts:29-33) cannot make the sign-out prompt
-- re-appear on a job that has already been closed.
--
-- See DLV-30412 (Andre Alves / Studio321B) for the incident: crew
-- captured the signature on the client's device, POST vanished mid
-- flight on rural 4G, page reloaded, prompt reappeared, crew chose
-- skip → the signature was lost server-side.

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS signoff_completed_at TIMESTAMPTZ;

-- Backfill from existing signed rows.
UPDATE public.deliveries d
SET signoff_completed_at = cso.signed_at
FROM public.client_sign_offs cso
WHERE cso.job_type = 'delivery'
  AND cso.job_id = d.id::text
  AND d.signoff_completed_at IS NULL
  AND cso.signed_at IS NOT NULL;

-- Backfill from skip rows for deliveries closed via the skip path.
-- signoff_skips.job_id is TEXT (not UUID), so cast the delivery uuid.
UPDATE public.deliveries d
SET signoff_completed_at = ss.created_at
FROM public.signoff_skips ss
WHERE ss.job_type = 'delivery'
  AND ss.job_id = d.id::text
  AND d.signoff_completed_at IS NULL;

NOTIFY pgrst, 'reload schema';
