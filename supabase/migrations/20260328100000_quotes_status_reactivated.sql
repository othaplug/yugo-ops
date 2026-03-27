-- Allow reactivated quotes (used by quote-reengagement + expiry cron).
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN (
    'draft',
    'sent',
    'viewed',
    'accepted',
    'expired',
    'declined',
    'superseded',
    'reactivated'
  ));
