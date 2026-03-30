-- Parsed heavy/specialty signals from freeform intake; coordinator specialty quote builder triggers.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS parsed_weight_lbs_max NUMERIC,
  ADD COLUMN IF NOT EXISTS parsed_dimensions_text TEXT,
  ADD COLUMN IF NOT EXISTS requires_specialty_quote BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.leads.parsed_weight_lbs_max IS 'Max weight in lbs detected from message/inventory text (e.g. 600 from "600lb")';
COMMENT ON COLUMN public.leads.parsed_dimensions_text IS 'Best-effort dimensions snippet from freeform text';
COMMENT ON COLUMN public.leads.requires_specialty_quote IS 'True when intake rules flag one-off specialty / heavy B2B (manual review, specialty builder)';
