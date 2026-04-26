-- Crew GPS / idle slugs (and other notifyAdmins slugs) as notification_events so
-- Settings → Notifications can persist email/SMS/push prefs (FK on notification_preferences).
--
-- Ops+ email/SMS fan-out: disable for oche@helloyugo.com on every known event; push stays on
-- so in-app notifications still work. othaplug@gmail.com and other staff keep defaults.

INSERT INTO public.notification_events (event_slug, event_name, description, category, display_order) VALUES
('crew_idle_off_route', 'Crew idle off job stops', 'Crew GPS shows extended idle away from scheduled job stops', 'crew', 33),
('crew_gps_offline', 'Crew GPS offline', 'Crew location has not updated within the expected window', 'crew', 34),
('quote_declined', 'Quote declined', 'Client declined a sent quote', 'quotes', 6),
('quote_cold', 'Quote went cold', 'Quote engagement dropped below threshold', 'quotes', 7),
('quote_comparison_signal', 'Quote comparison signal', 'Client activity suggests they are comparing quotes', 'quotes', 8),
('lead_new', 'New lead', 'A new lead was captured for coordinator follow-up', 'system', 60),
('partner_pm_booking', 'PM booking request', 'Partner or client submitted a project management booking request', 'moves', 61),
('move_waiver_signed', 'On-site waiver signed', 'Client signed the on-site waiver during the move', 'moves', 18),
('move_waiver_declined', 'On-site waiver declined', 'Client declined the on-site waiver during the move', 'moves', 19),
('move_scheduled', 'Move scheduled', 'A move was scheduled or rescheduled', 'moves', 20),
('scheduling_conflict', 'Scheduling conflict', 'Auto-schedule detected a crew or calendar conflict', 'moves', 21),
('no_availability', 'No availability', 'Auto-schedule could not find an open slot', 'moves', 22),
('claim_submitted', 'New claim submitted', 'A damage or claim was submitted for review', 'system', 62)
ON CONFLICT (event_slug) DO NOTHING;

INSERT INTO public.notification_preferences (user_id, event_slug, email_enabled, sms_enabled, push_enabled)
SELECT pu.user_id, e.event_slug, false, false, true
FROM public.platform_users pu
CROSS JOIN public.notification_events e
WHERE lower(trim(pu.email)) = lower(trim('oche@helloyugo.com'))
ON CONFLICT (user_id, event_slug)
DO UPDATE SET
  email_enabled = false,
  sms_enabled = false,
  push_enabled = true;

-- Single-address crew/ops emails (walkthrough summary, tips admin alert) use platform_config.admin_notification_email.
UPDATE public.platform_config
SET value = 'othaplug@gmail.com'
WHERE key = 'admin_notification_email'
  AND lower(trim(value)) = lower('oche@helloyugo.com');
