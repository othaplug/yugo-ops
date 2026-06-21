-- Auto-charge approved additional items / change-request fees to the card on
-- file. Once charged, the fee must stop counting as an outstanding balance, so
-- we track the charge on the source row (extra_items, move_change_requests).

ALTER TABLE public.extra_items
  ADD COLUMN IF NOT EXISTS payment_charged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS square_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS charged_at TIMESTAMPTZ;

ALTER TABLE public.move_change_requests
  ADD COLUMN IF NOT EXISTS payment_charged BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS square_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS charged_at TIMESTAMPTZ;

COMMENT ON COLUMN public.extra_items.payment_charged IS 'True once fee_cents was auto-charged to the move card on file; excluded from outstanding-balance sums.';
COMMENT ON COLUMN public.move_change_requests.payment_charged IS 'True once fee_cents was auto-charged to the move card on file; excluded from outstanding-balance sums.';
