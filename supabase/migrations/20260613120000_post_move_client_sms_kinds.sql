-- Post-move client SMS: timely, rating-gated text sent ~1h after completion.
-- Adds two new `kind` values to scheduled_move_client_sms so the move-client-sms
-- cron (every 3 min) can deliver:
--   • post_move_review   → 4–5★ sign-off → thank-you + Google review ask
--   • post_move_recovery → 1–3★ sign-off → luxury service-recovery outreach
--
-- Previously the "your move is complete" text rode the once-daily
-- /api/cron/review-requests job, so it landed the NEXT morning. Routing it
-- through the 3-minute queue makes it land ~1h after the move, conditioned on
-- the star rating the client gave during sign-off.

ALTER TABLE public.scheduled_move_client_sms
  DROP CONSTRAINT IF EXISTS scheduled_move_client_sms_kind_check;

ALTER TABLE public.scheduled_move_client_sms
  ADD CONSTRAINT scheduled_move_client_sms_kind_check
  CHECK (kind IN (
    'en_route_checkin',
    'long_unload_checkin',
    'post_move_review',
    'post_move_recovery'
  ));
