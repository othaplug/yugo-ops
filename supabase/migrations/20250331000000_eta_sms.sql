-- ═══════════════════════════════════════════════════
-- PROMPT 81: Automated SMS ETA System
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.eta_sms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job reference (one of these will be set, not both)
  move_id UUID REFERENCES public.moves(id),
  delivery_id UUID REFERENCES public.deliveries(id),
  delivery_stop_index INTEGER DEFAULT 0,

  -- Recipient
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT NOT NULL,

  -- Message tracking
  message_type TEXT NOT NULL CHECK (message_type IN (
    'crew_departed',
    'eta_15_min',
    'crew_arrived',
    'in_progress',
    'completed'
  )),
  message_body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  twilio_sid TEXT,

  -- ETA data at time of send
  eta_minutes INTEGER,
  crew_lat NUMERIC,
  crew_lng NUMERIC,
  destination_lat NUMERIC,
  destination_lng NUMERIC,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eta_sms_move ON public.eta_sms_log(move_id);
CREATE INDEX IF NOT EXISTS idx_eta_sms_delivery ON public.eta_sms_log(delivery_id);
CREATE INDEX IF NOT EXISTS idx_eta_sms_type ON public.eta_sms_log(move_id, message_type);
CREATE INDEX IF NOT EXISTS idx_eta_sms_delivery_type ON public.eta_sms_log(delivery_id, message_type);

-- ETA tracking columns on moves
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS
  eta_tracking_active BOOLEAN DEFAULT FALSE;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS
  eta_last_checked_at TIMESTAMPTZ;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS
  eta_current_minutes INTEGER;

-- ETA tracking columns on deliveries
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS
  eta_tracking_active BOOLEAN DEFAULT FALSE;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS
  eta_last_checked_at TIMESTAMPTZ;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS
  eta_current_minutes INTEGER;

-- Feature toggle for SMS ETA
INSERT INTO public.platform_config (key, value, description) VALUES
  ('sms_eta_enabled', 'false', 'Send automated SMS to clients with crew ETA on move day')
ON CONFLICT (key) DO NOTHING;
