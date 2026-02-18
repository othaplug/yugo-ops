-- Extend gallery_projects for luxury art transport: address, type, gallery FK, and service fields
ALTER TABLE public.gallery_projects
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS project_type TEXT CHECK (project_type IN ('exhibition', 'delivery', 'install', 'storage_retrieval', 'art_fair', 'other')),
  ADD COLUMN IF NOT EXISTS gallery_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS white_glove BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crating_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS climate_controlled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insurance_value TEXT,
  ADD COLUMN IF NOT EXISTS install_deinstall_notes TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

CREATE INDEX IF NOT EXISTS idx_gallery_projects_gallery_org ON public.gallery_projects (gallery_org_id);
CREATE INDEX IF NOT EXISTS idx_gallery_projects_type ON public.gallery_projects (project_type);
