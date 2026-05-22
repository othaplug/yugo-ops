-- Designer Project Foundation
-- Adds: project_vendors table, vendor_id + dual-photo + placement_notes on
-- project_inventory, and designer-specific coordinate/phase fields on projects.
--
-- ADDITIVE ONLY — no existing columns, constraints, or policies are altered.
-- All existing partner portal queries and PartnerB2BProjectsTab continue
-- to work unchanged. The designer_phase column is orthogonal to projects.status.

-- ─── 1. project_vendors ────────────────────────────────────────────────────────
-- Vendors are now first-class project objects with their own readiness lifecycle.
-- Replaces the pattern of embedding vendor_name/contact as text on each
-- project_inventory row. Items gain an optional vendor_id FK below.

CREATE TABLE IF NOT EXISTS public.project_vendors (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  vendor_name         TEXT NOT NULL,
  vendor_address      TEXT,
  -- No CHECK on vendor_access — delivery_stops.access_type uses no constraint either,
  -- keeping it free-text so new access types don't require a migration.
  vendor_access       TEXT DEFAULT 'ground_floor',
  vendor_access_notes TEXT,

  contact_name        TEXT,
  contact_phone       TEXT,
  contact_email       TEXT,

  -- Coordination readiness lifecycle
  readiness           TEXT NOT NULL DEFAULT 'pending'
                      CHECK (readiness IN (
                        'pending', 'confirmed', 'partial', 'delayed', 'received'
                      )),
  readiness_notes     TEXT,

  pickup_date         DATE,
  pickup_window       TEXT,

  -- Who confirmed and when (set by coordinator, not auto-filled)
  confirmed_at        TIMESTAMPTZ,
  confirmed_by        TEXT,
  received_at         TIMESTAMPTZ,

  -- Controls display order in vendor tab and stop sequence on install day
  sort_order          INTEGER DEFAULT 0,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_vendors_project_id
  ON public.project_vendors(project_id);

CREATE INDEX IF NOT EXISTS idx_project_vendors_readiness
  ON public.project_vendors(readiness);

-- ─── 2. project_inventory extensions ──────────────────────────────────────────

-- Link items to their vendor record.
-- Nullable: items can exist without a vendor (delivered directly, from designer storage).
ALTER TABLE public.project_inventory
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.project_vendors(id);

-- Distinguish pickup condition photo from post-placement photo.
-- Existing photo_urls TEXT[] stays — these two columns add semantic clarity.
ALTER TABLE public.project_inventory
  ADD COLUMN IF NOT EXISTS pickup_photo_url   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT;

-- Designer placement instruction per item (e.g. "place against east wall, 18in from corner").
-- Different from special_handling_notes (logistics) and inspection_notes (condition).
ALTER TABLE public.project_inventory
  ADD COLUMN IF NOT EXISTS placement_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_project_inventory_vendor_id
  ON public.project_inventory(vendor_id);

-- ─── 3. projects: designer coordinate + metadata fields ────────────────────────
-- projects.site_address holds the street address.
-- These new columns hold the sub-detail needed for install coordination.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS install_unit          TEXT,
  ADD COLUMN IF NOT EXISTS install_floor         TEXT,
  -- Free-text access type (matches delivery_stops.access_type pattern — no CHECK)
  ADD COLUMN IF NOT EXISTS install_access        TEXT DEFAULT 'elevator',
  ADD COLUMN IF NOT EXISTS install_access_notes  TEXT;

-- Room list for the project (which rooms the designer is furnishing)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS rooms                 JSONB DEFAULT '[]';

-- Placement spec upload (PDF or image URL — uploaded by designer or coordinator)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS placement_spec_url    TEXT;

-- Who at Yugo is running this project day-to-day
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS coordinator_id        UUID,
  ADD COLUMN IF NOT EXISTS coordinator_name      TEXT;

-- CRM linkage
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS hubspot_deal_id       TEXT;

-- The delivery job created at "Schedule Install Day" — links the project to its execution
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS delivery_job_id       UUID REFERENCES public.deliveries(id);

-- ─── 4. designer_phase: inner coordination lifecycle ──────────────────────────
-- projects.status remains: draft / proposed / active / on_hold / completed /
--   invoiced / cancelled  (CHECK constraint unchanged, existing queries unaffected)
-- designer_phase tracks the coordination sub-lifecycle for interior_designer projects.
-- The outer status stays 'active' while designer_phase progresses internally.
-- When designer_phase reaches 'completed', the caller also sets status = 'completed'.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS designer_phase TEXT
  CHECK (designer_phase IN (
    'planning',
    'vendor_coordination',
    'staging',
    'install_ready',
    'install_scheduled',
    'completed'
  ));

CREATE INDEX IF NOT EXISTS idx_projects_designer_phase
  ON public.projects(designer_phase)
  WHERE designer_phase IS NOT NULL;

-- ─── 5. RLS ───────────────────────────────────────────────────────────────────
-- Matches the pattern used by project_status_log in 20260317000000.
-- Service role has full access (used by admin API routes).
-- Authenticated users can read vendors for projects belonging to their org.

ALTER TABLE public.project_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_vendors_service_role"
  ON public.project_vendors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "project_vendors_auth_read"
  ON public.project_vendors
  FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT p.id
      FROM public.projects p
      INNER JOIN public.partner_users pu ON pu.org_id = p.partner_id
      WHERE pu.user_id = auth.uid()
    )
  );
