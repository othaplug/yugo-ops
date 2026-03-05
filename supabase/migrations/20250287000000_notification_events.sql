-- ══════════════════════════════════════════════════
-- Notification Events — event-based notification configuration
-- ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_slug TEXT NOT NULL UNIQUE,
  event_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'quotes', 'moves', 'payments', 'crew', 'partners', 'system'
  )),
  supports_email BOOLEAN DEFAULT TRUE,
  supports_sms BOOLEAN DEFAULT TRUE,
  supports_push BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.notification_events (event_slug, event_name, description, category, display_order) VALUES
('quote_requested',     'New Quote Request',        'Client submits a quote request from the website',     'quotes', 1),
('quote_viewed',        'Quote Viewed by Client',   'Client opens the quote page for the first time',      'quotes', 2),
('quote_expiring_soon', 'Quote Expiring (48hrs)',    'A sent quote is expiring within 48 hours',            'quotes', 3),
('quote_expired',       'Quote Expired',            'A quote passed its expiry date without booking',      'quotes', 4),
('quote_accepted',      'Quote Accepted / Booked',  'Client accepts a quote and completes booking',        'quotes', 5),
('move_tomorrow',       'Move Tomorrow Reminder',   'A confirmed move is scheduled for tomorrow',          'moves', 10),
('move_started',        'Move Started',             'Crew checked in and started the move',                'moves', 11),
('move_completed',      'Move Completed',           'Crew marked the move as complete',                    'moves', 12),
('move_issue',          'Move Issue Reported',      'Crew or client reported a problem during move',       'moves', 13),
('payment_received',    'Payment Received',         'Client payment processed successfully',               'payments', 20),
('payment_failed',      'Payment Failed',           'Client payment was declined or failed',               'payments', 21),
('deposit_received',    'Deposit Received',         'Client paid the booking deposit',                     'payments', 22),
('tip_received',        'Tip Received',             'Client left a tip after move completion',             'payments', 23),
('crew_checkin',        'Crew Check-In',            'Crew member checked in for their shift',              'crew', 30),
('crew_no_checkin',     'Crew No-Show Alert',       'Crew member did not check in by expected time',       'crew', 31),
('checklist_incomplete','Readiness Check Failed',   'Pre-trip readiness checklist has unchecked items',    'crew', 32),
('partner_job_request', 'New Partner Job Request',  'A B2B partner submitted a delivery/move request',    'partners', 40),
('partner_job_complete','Partner Job Completed',    'A partner job was marked complete',                   'partners', 41),
('low_margin_alert',    'Low Margin Alert',         'A completed move fell below target margin',           'system', 50),
('high_value_move',     'High-Value Move Flag',     'A move has declared value over alert threshold',      'system', 51),
('system_error',        'System Error',             'An integration or background job failed',             'system', 52)
ON CONFLICT (event_slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_slug TEXT NOT NULL REFERENCES public.notification_events(event_slug),
  email_enabled BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  push_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_slug)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON public.notification_preferences(user_id);
