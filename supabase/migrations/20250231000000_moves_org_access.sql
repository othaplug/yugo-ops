-- Link moves to organizations (clients) and add access dropdowns per address
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.moves DROP COLUMN IF EXISTS access;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS from_access TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS to_access TEXT;
CREATE INDEX IF NOT EXISTS idx_moves_organization_id ON public.moves (organization_id);
