-- Optional admin-set fee when approving a change request (amount in cents)
ALTER TABLE public.move_change_requests
  ADD COLUMN IF NOT EXISTS fee_cents INT DEFAULT 0 CHECK (fee_cents >= 0);

-- Optional admin-set fee when approving an extra item (amount in cents)
ALTER TABLE public.extra_items
  ADD COLUMN IF NOT EXISTS fee_cents INT DEFAULT 0 CHECK (fee_cents >= 0);

COMMENT ON COLUMN public.move_change_requests.fee_cents IS 'Optional fee in cents when admin approves (charged to client).';
COMMENT ON COLUMN public.extra_items.fee_cents IS 'Optional fee in cents when admin approves (charged to client).';
