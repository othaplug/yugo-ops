-- Prompt 100: Gallery Project Items + Condition Reporting
-- ── gallery_project_items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gallery_project_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES public.gallery_projects(id) ON DELETE CASCADE,

  -- Artwork identification
  title              TEXT NOT NULL,
  artist             TEXT,
  medium             TEXT,
  dimensions         TEXT,  -- e.g. "24 x 36 in"
  weight_kg          NUMERIC,
  serial_number      TEXT,
  insurance_value    TEXT,   -- string so client can type "$12,500 CAD"

  -- Handling flags
  crating_required   BOOLEAN NOT NULL DEFAULT false,
  climate_sensitive  BOOLEAN NOT NULL DEFAULT false,
  fragile            BOOLEAN NOT NULL DEFAULT false,
  handling_notes     TEXT,

  -- Condition reporting (pre-transport)
  pre_condition      TEXT CHECK (pre_condition IN ('excellent','good','fair','poor','damaged')),
  pre_condition_notes TEXT,
  pre_condition_photos TEXT[],   -- array of storage paths / URLs
  pre_condition_at   TIMESTAMPTZ,
  pre_condition_by   TEXT,

  -- Condition reporting (post-transport)
  post_condition     TEXT CHECK (post_condition IN ('excellent','good','fair','poor','damaged')),
  post_condition_notes TEXT,
  post_condition_photos TEXT[],
  post_condition_at  TIMESTAMPTZ,
  post_condition_by  TEXT,

  -- Discrepancy flag (raised when pre ≠ post)
  condition_discrepancy BOOLEAN GENERATED ALWAYS AS (
    pre_condition IS NOT NULL AND post_condition IS NOT NULL AND pre_condition <> post_condition
  ) STORED,

  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_items_project ON public.gallery_project_items (project_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_discrepancy ON public.gallery_project_items (condition_discrepancy) WHERE condition_discrepancy = true;

ALTER TABLE public.gallery_project_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage gallery_project_items"
  ON public.gallery_project_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── gallery_projects: add item_count + condition summary view columns ─────────
ALTER TABLE public.gallery_projects
  ADD COLUMN IF NOT EXISTS requires_condition_report BOOLEAN NOT NULL DEFAULT true;
