-- Retire outbound_shipments.partner_tracking_token.
--
-- This token only ever fed the partner-facing /outbound/track/[id] page, which
-- was removed (its client API had already been deleted in the portal cleanup).
-- Nothing reads or writes the column any more, so drop it and its index.
-- Partners are served by their status-transition emails + PM portal view.

DROP INDEX IF EXISTS public.idx_outbound_shipments_token;

ALTER TABLE public.outbound_shipments
  DROP COLUMN IF EXISTS partner_tracking_token;

NOTIFY pgrst, 'reload schema';
