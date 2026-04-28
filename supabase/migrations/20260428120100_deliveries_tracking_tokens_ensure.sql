-- Idempotent repair: B2B delivery tracking tokens on public.deliveries.
-- Fixes PostgREST "Could not find the 'recipient_tracking_token' column ... in the schema cache"
-- when 20260328000000_b2b_tracking_equipment.sql was skipped or cache was stale.

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS tracking_token TEXT,
  ADD COLUMN IF NOT EXISTS recipient_tracking_token TEXT,
  ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS b2b_business_notify_en_route_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS b2b_business_notify_delivered_sent_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_tracking_token
  ON public.deliveries (tracking_token) WHERE tracking_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_recipient_tracking_token
  ON public.deliveries (recipient_tracking_token) WHERE recipient_tracking_token IS NOT NULL;

NOTIFY pgrst, 'reload schema';
