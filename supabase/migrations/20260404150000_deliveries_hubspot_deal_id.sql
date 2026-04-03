ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS hubspot_deal_id TEXT;

CREATE INDEX IF NOT EXISTS idx_deliveries_hubspot_deal_id
  ON public.deliveries (hubspot_deal_id)
  WHERE hubspot_deal_id IS NOT NULL;

COMMENT ON COLUMN public.deliveries.hubspot_deal_id IS 'HubSpot CRM deal id when synced from B2B quote or pipeline automation';
