-- Add 'contract_signed' to the valid event types for quote_events table.

ALTER TABLE public.quote_events
DROP CONSTRAINT IF EXISTS quote_events_event_type_check;

ALTER TABLE public.quote_events
ADD CONSTRAINT quote_events_event_type_check
CHECK (event_type IN (
  'quote_viewed',
  'tier_selected',
  'addon_toggled',
  'contract_started',
  'contract_signed',
  'payment_started',
  'quote_abandoned'
));
