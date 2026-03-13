-- Backfill moves.completed_at from tracking_sessions for moves that were marked completed
-- before the checkpoint route was updated to set completed_at. Uses the latest session's
-- completed_at per move when multiple sessions exist.
UPDATE public.moves m
SET completed_at = sub.completed_at
FROM (
  SELECT DISTINCT ON (job_id) job_id, completed_at
  FROM public.tracking_sessions
  WHERE job_type = 'move'
    AND completed_at IS NOT NULL
  ORDER BY job_id, completed_at DESC
) sub
WHERE sub.job_id = m.id::text
  AND m.status = 'completed'
  AND m.completed_at IS NULL;
