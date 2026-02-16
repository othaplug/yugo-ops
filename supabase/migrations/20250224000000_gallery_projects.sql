-- Gallery projects table for Create Project flow
CREATE TABLE IF NOT EXISTS public.gallery_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gallery TEXT,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'staging', 'scheduled', 'in_transit', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_projects_status ON public.gallery_projects (status);
CREATE INDEX IF NOT EXISTS idx_gallery_projects_created ON public.gallery_projects (created_at DESC);

ALTER TABLE public.gallery_projects ENABLE ROW LEVEL SECURITY;

-- Allow platform users and partners (gallery page is under admin)
CREATE POLICY "Authenticated can manage gallery_projects"
  ON public.gallery_projects FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
