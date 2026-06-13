-- Notification settings wiring fix.
--
-- Bug: admin turns "All Email OFF" but still receives email notifications.
-- Root cause: the code emits ~14 notification event slugs that were never in
-- the notification_events catalog. The master toggle only writes preference
-- rows for catalog events, so these slugs had no pref row → sendNotification's
-- `email_enabled ?? true` defaulted them to ON → they kept emailing.
--
-- Fix part 1: backfill the missing catalog events so every slug the code emits
--             is visible + individually toggleable.
-- Fix part 2: add a per-user, per-channel MUTE on platform_users. It acts as
--             the default for any slug WITHOUT an explicit per-event pref row,
--             so "All Email OFF" suppresses even slugs not in the catalog —
--             now and for any future slug. An explicit per-event pref still
--             wins (so re-enabling a single event works while muted).

-- ── Part 1: backfill catalog events the code actually emits ──
INSERT INTO public.notification_events (event_slug, event_name, description, category, display_order) VALUES
  ('quote_declined',           'Quote Declined',            'Client declined a sent quote',                          'quotes',   40),
  ('quote_hot',                'Hot Quote',                 'Quote viewed multiple times — high intent',             'quotes',   41),
  ('quote_cold',               'Quote Went Cold',           'A sent quote has gone quiet with no activity',          'quotes',   42),
  ('quote_comparison_signal',  'Quote Comparison Signal',   'Behavioral signal the client is comparing options',     'quotes',   43),
  ('lead_new',                 'New Lead',                  'A new lead was captured',                               'quotes',   44),
  ('move_scheduled',           'Move Scheduled',            'A move was placed on the schedule',                     'moves',    50),
  ('move_waiver_signed',       'On-site Waiver Signed',     'Client signed the on-site waiver',                      'moves',    51),
  ('move_waiver_declined',     'On-site Waiver Declined',   'Client declined the on-site waiver',                    'moves',    52),
  ('scheduling_conflict',      'Scheduling Conflict',       'A crew/date scheduling conflict was detected',          'moves',    53),
  ('no_availability',          'No Availability',           'No crew/availability for a requested slot',             'moves',    54),
  ('crew_gps_offline',         'Crew GPS Offline',          'A crew device stopped reporting GPS during a job',      'crew',     60),
  ('crew_idle_off_route',      'Crew Idle Off Route',       'Crew idle away from the planned job stops',             'crew',     61),
  ('partner_pm_booking',       'PM Booking Request',        'A property-management partner booked a move',           'partners', 70),
  ('partner_pm_batch',         'PM Batch Created',          'A property-management partner created a batch',          'partners', 71)
ON CONFLICT (event_slug) DO NOTHING;

-- ── Part 2: per-user, per-channel mute (default for slugs without a pref row) ──
ALTER TABLE public.platform_users
  ADD COLUMN IF NOT EXISTS notif_mute_email BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notif_mute_sms   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notif_mute_push  BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: any user who had already turned ALL email prefs off (i.e. did
-- "All Email OFF") gets the email mute set, so their existing choice takes
-- effect immediately for the previously-leaking slugs.
UPDATE public.platform_users pu
SET notif_mute_email = TRUE
WHERE pu.user_id IN (
  SELECT user_id
  FROM public.notification_preferences
  GROUP BY user_id
  HAVING bool_or(email_enabled) = FALSE
);
