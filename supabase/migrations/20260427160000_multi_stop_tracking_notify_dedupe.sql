-- Dedupe client tracking notifications when the same checkpoint is fired twice in quick succession
-- (e.g. admin stage edit + crew stop flow, or double PATCH).
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS last_notified_tracking_status TEXT,
  ADD COLUMN IF NOT EXISTS last_notified_tracking_at TIMESTAMPTZ;

COMMENT ON COLUMN public.deliveries.last_notified_tracking_status IS 'Last tracking checkpoint for which client/partner notify was sent (multi-stop + crew flows)';
COMMENT ON COLUMN public.deliveries.last_notified_tracking_at IS 'Timestamp of last tracking notify for deduplication';

-- B2B multi-stop: ensure exactly one final leg row has the flag (crew UI + tracking derive)
UPDATE public.delivery_stops ds
SET is_final_destination = true
FROM public.deliveries d
WHERE ds.delivery_id = d.id
  AND COALESCE(d.is_multi_stop, false) = true
  AND COALESCE(ds.is_final_destination, false) = false
  AND ds.stop_number = (
    SELECT MAX(ds2.stop_number)
    FROM public.delivery_stops ds2
    WHERE ds2.delivery_id = d.id
  );
