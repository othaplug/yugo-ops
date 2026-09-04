-- The unified cadence adds three terminal statuses to review_requests:
--   final     touch 3 (the last email) has been sent; no further touch
--   done      the client responded (clicked or rated); sequence stopped early
--   cancelled permanently opted out or suppressed
-- Expand the status CHECK so the cron's updates are accepted.

ALTER TABLE public.review_requests
  DROP CONSTRAINT IF EXISTS review_requests_status_check;

ALTER TABLE public.review_requests
  ADD CONSTRAINT review_requests_status_check
  CHECK (status IN (
    'pending', 'sent', 'reminded', 'reviewed', 'skipped',
    'final', 'done', 'cancelled'
  ));
