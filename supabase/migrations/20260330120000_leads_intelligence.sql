-- Lead intelligence: parsed inventory, specialty detection, scoring metadata.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS from_access TEXT,
  ADD COLUMN IF NOT EXISTS to_access TEXT,
  ADD COLUMN IF NOT EXISTS preferred_time TEXT,
  ADD COLUMN IF NOT EXISTS raw_inventory_text TEXT,
  ADD COLUMN IF NOT EXISTS parsed_inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parsed_box_count INTEGER,
  ADD COLUMN IF NOT EXISTS inventory_parse_confidence TEXT,
  ADD COLUMN IF NOT EXISTS specialty_items_detected JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS has_specialty BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS assembly_needed TEXT,
  ADD COLUMN IF NOT EXISTS wrapping_needed TEXT,
  ADD COLUMN IF NOT EXISTS packing_help TEXT,
  ADD COLUMN IF NOT EXISTS insurance_preference TEXT,
  ADD COLUMN IF NOT EXISTS how_heard TEXT,
  ADD COLUMN IF NOT EXISTS referral_detail TEXT,
  ADD COLUMN IF NOT EXISTS priority_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS urgency_score INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS complexity_score INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS recommended_tier TEXT,
  ADD COLUMN IF NOT EXISTS intelligence_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_has_specialty ON public.leads (has_specialty) WHERE has_specialty = TRUE;
CREATE INDEX IF NOT EXISTS idx_leads_recommended_tier ON public.leads (recommended_tier) WHERE recommended_tier IS NOT NULL;
