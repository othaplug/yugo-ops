-- Extra items: introduce `awaiting_client` so admin approval STAGES a fee
-- but doesn't auto-charge. The client gets an email + SMS with Accept and
-- Decline CTAs; only Accept triggers the card charge.
--
-- Driven by the Chidera Allison (MV-30228) post-mortem: clients should
-- never be caught off-guard by a charge that appears on their card without
-- explicit consent on the dollar amount. The previous flow charged at the
-- moment admin approved.

ALTER TABLE public.extra_items DROP CONSTRAINT IF EXISTS extra_items_status_check;

ALTER TABLE public.extra_items
  ADD CONSTRAINT extra_items_status_check
  CHECK (status IN ('pending', 'awaiting_client', 'approved', 'rejected'));

COMMENT ON COLUMN public.extra_items.status IS
  'Lifecycle: pending (client/crew requested) -> awaiting_client (admin staged a fee, client must accept) -> approved (client accepted + card charged) | rejected (client or admin declined).';
