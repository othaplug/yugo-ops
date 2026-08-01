-- Cross-pipeline SMS dedup key.
--
-- The immediate checkpoint SMS (notifyOnCheckpoint) and the mid-move
-- cron (scheduled_move_client_sms) can no longer double-fire on
-- en_route_to_destination — the scheduler for that milestone was
-- retired in the previous commit. This adds a belt-and-suspenders
-- guard so any FUTURE overlap (a new checkpoint kind, a new cron job,
-- a manual retry, etc.) collides at the DB layer instead of silently
-- sending twice.
--
-- Semantics: a caller computes a key like "move:{uuid}:tracking:
-- en_route_to_destination", tries to insert notification_log with
-- that key + status='pending' BEFORE calling sendSMS. If the insert
-- succeeds it owns the send; if it hits the unique index another
-- pipeline already claimed this milestone and the caller skips.
--
-- Partial unique index so failed sends don't permanently block
-- retries. Nullable — legacy audit-only rows (no key) still write
-- successfully.

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS notification_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS notification_log_key_unique
  ON public.notification_log (notification_key)
  WHERE notification_key IS NOT NULL
    AND status IN ('sent', 'pending');
