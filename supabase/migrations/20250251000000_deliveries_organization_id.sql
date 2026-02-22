-- Link deliveries to organizations for partner portal (partner can see their deliveries)
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_organization_id ON public.deliveries (organization_id);

-- Backfill: link existing deliveries where client_name matches org name
UPDATE public.deliveries d
SET organization_id = o.id
FROM public.organizations o
WHERE d.organization_id IS NULL
  AND d.client_name IS NOT NULL
  AND TRIM(d.client_name) <> ''
  AND LOWER(TRIM(d.client_name)) = LOWER(TRIM(o.name));

-- Optional: pickup_access and delivery_access for crew Details tab (like moves)
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pickup_access TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_access TEXT;
