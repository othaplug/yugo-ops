-- Permanent email mute for oche@helloyugo.com — DB-level safety net.
--
-- The previous mute migration (20260426140000) only covered the 13
-- notification_events that existed on that date. 13 new events have been
-- added since (crew_checkin, crew_no_checkin, in_job_margin_alert,
-- in_job_schedule_alert, move_tomorrow, payment_received, tip_received,
-- etc.) and each one inherited the default email_enabled=true → emails
-- kept landing in this inbox despite the mute.
--
-- Two fixes here:
--
--   1. Backfill — set email_enabled=false, sms_enabled=false (push stays
--      on so in-app + push still work) for EVERY current event slug.
--
--   2. Trigger — any notification_event added in the future automatically
--      gets the same muted preference inserted for this user. The
--      trigger is keyed off the email so future user_id changes don't
--      break it.
--
-- Note: the canonical guarantee against email leaks for this address
-- now lives in src/lib/email/send.ts (`PERMANENT_RECIPIENT_MUTE`) which
-- blocks at the I/O boundary regardless of preferences. This migration
-- keeps the in-app notification-preferences UI accurate.

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.platform_users
  WHERE lower(trim(email)) = lower('oche@helloyugo.com')
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No platform_users row for oche@helloyugo.com — skipping backfill';
    RETURN;
  END IF;

  -- Upsert false email + false SMS for every existing event
  INSERT INTO public.notification_preferences
    (user_id, event_slug, email_enabled, sms_enabled, push_enabled)
  SELECT
    v_user_id,
    e.event_slug,
    false,
    false,
    true
  FROM public.notification_events e
  ON CONFLICT (user_id, event_slug)
  DO UPDATE SET
    email_enabled = false,
    sms_enabled = false,
    push_enabled = true;
END $$;

-- Trigger function: insert muted preferences for oche whenever a new
-- notification_event is added. Idempotent via ON CONFLICT.
CREATE OR REPLACE FUNCTION public.mute_email_for_oche_on_new_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.platform_users
  WHERE lower(trim(email)) = lower('oche@helloyugo.com')
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.notification_preferences
      (user_id, event_slug, email_enabled, sms_enabled, push_enabled)
    VALUES (v_user_id, NEW.event_slug, false, false, true)
    ON CONFLICT (user_id, event_slug)
    DO UPDATE SET email_enabled = false, sms_enabled = false, push_enabled = true;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_mute_email_for_oche_on_new_event
  ON public.notification_events;

CREATE TRIGGER trg_mute_email_for_oche_on_new_event
  AFTER INSERT ON public.notification_events
  FOR EACH ROW
  EXECUTE FUNCTION public.mute_email_for_oche_on_new_event();

-- Belt-and-braces: ensure platform_config.admin_notification_email is not
-- pointing at oche. Set to empty string so the existing fallback chain
-- (NEXT_PUBLIC_YUGO_EMAIL → 'notifications@yugoplus.co') takes over.
UPDATE public.platform_config
SET value = ''
WHERE key = 'admin_notification_email'
  AND lower(trim(value)) = lower('oche@helloyugo.com');
