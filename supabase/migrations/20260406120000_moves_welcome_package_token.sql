-- Token-gated Estate welcome guide URL (/estate/welcome/[token]).
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS welcome_package_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_moves_welcome_package_token_unique
  ON public.moves (welcome_package_token)
  WHERE welcome_package_token IS NOT NULL;

COMMENT ON COLUMN public.moves.welcome_package_token IS
  'Opaque token for /estate/welcome/[token]; generated on Estate booking confirmation.';

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS estate_30day_checkin_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.moves.estate_30day_checkin_sent_at IS
  'When the Estate 30-day concierge check-in email was sent (idempotent).';
