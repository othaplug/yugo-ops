-- HubSpot: flag when another open deal exists for the same contact (avoid duplicate deals)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS hubspot_duplicate_detected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS hubspot_existing_deal_id TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS hubspot_existing_deal_name TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS hubspot_existing_deal_stage TEXT;

COMMENT ON COLUMN public.quotes.hubspot_duplicate_detected IS 'True when send flow found an open HubSpot deal for the contact and skipped auto-creating a deal';
COMMENT ON COLUMN public.quotes.hubspot_existing_deal_id IS 'HubSpot deal id found for duplicate warning';
