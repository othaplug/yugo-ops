-- Quote versioning: in-place update tracking + explicit duplicate support
-- Adds version metadata to quotes and creates a quote_versions snapshot table.

-- ── New columns on quotes ─────────────────────────────────────────────────
-- version already exists (INT DEFAULT 1) — used as version_number
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS last_regenerated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_regenerated_by  UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_revised           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS superseded_by        UUID REFERENCES public.quotes(id),
  ADD COLUMN IF NOT EXISTS superseded_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duplicated_from      UUID REFERENCES public.quotes(id);

-- ── quote_versions table ──────────────────────────────────────────────────
-- Each row is a point-in-time snapshot of a quotes row captured just before
-- an in-place re-generation overwrites it.
CREATE TABLE IF NOT EXISTS public.quote_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  version_number  INT  NOT NULL DEFAULT 1,
  snapshot        JSONB NOT NULL,
  regenerated_by  UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_versions_quote ON public.quote_versions(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_versions_quote_version ON public.quote_versions(quote_id, version_number);

-- RLS: admins (authenticated) can read; no client access needed
ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read quote_versions"
  ON public.quote_versions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert quote_versions"
  ON public.quote_versions FOR INSERT
  TO authenticated WITH CHECK (true);
