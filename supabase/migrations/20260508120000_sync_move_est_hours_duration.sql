-- Fix moves where estimated_duration_minutes doesn't match est_hours × 60.
-- Root cause: the duration model ran for local_move even when est_hours was
-- set on the quote, producing a different (usually much shorter) value that
-- was stored at move creation. The display now prefers est_hours, but this
-- migration aligns estimated_duration_minutes for correctness in all paths.
--
-- Only touches confirmed/pending moves that have est_hours but a mismatched
-- estimated_duration_minutes. Completed/cancelled moves are left as-is to
-- preserve historical actuals.

UPDATE moves
SET
  estimated_duration_minutes = ROUND(est_hours * 60)
WHERE
  est_hours IS NOT NULL
  AND est_hours > 0
  AND estimated_duration_minutes IS NOT NULL
  AND estimated_duration_minutes > 0
  AND ABS(estimated_duration_minutes - ROUND(est_hours * 60)) > 5
  AND status NOT IN ('completed', 'cancelled', 'no_show');
