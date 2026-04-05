-- Quote decline, cold/lost lifecycle, follow-up tracking, secure client action token

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS public_action_token TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS decline_comment TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS auto_followup_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS cold_reason TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS went_cold_at TIMESTAMPTZ;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS loss_reason TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;

UPDATE public.quotes
SET public_action_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
WHERE public_action_token IS NULL OR trim(public_action_token) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_public_action_token
  ON public.quotes (public_action_token)
  WHERE public_action_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.quote_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_opened BOOLEAN NOT NULL DEFAULT FALSE,
  email_opened_at TIMESTAMPTZ,
  link_clicked BOOLEAN NOT NULL DEFAULT FALSE,
  link_clicked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_quote_followups_quote_id ON public.quote_followups(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_followups_sent_at ON public.quote_followups(quote_id, sent_at);

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
    'reactivated',
    'cold',
    'lost'
  ));
