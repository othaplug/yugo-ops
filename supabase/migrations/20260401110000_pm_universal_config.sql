-- =============================================================================
-- Universal property-management configuration (reasons, rate matrix, projects)
-- Replaces renovation-only assumptions; partners = organizations.id
-- =============================================================================

-- Move reasons: partner_id NULL = global default; non-null = org-specific custom
CREATE TABLE IF NOT EXISTS public.pm_move_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  is_round_trip BOOLEAN NOT NULL DEFAULT FALSE,
  default_origin TEXT NOT NULL DEFAULT 'custom'
    CHECK (default_origin IN ('unit', 'storage', 'external', 'custom')),
  default_destination TEXT NOT NULL DEFAULT 'custom'
    CHECK (default_destination IN ('unit', 'storage', 'external', 'custom')),
  requires_return_move BOOLEAN NOT NULL DEFAULT FALSE,
  urgency_default TEXT NOT NULL DEFAULT 'standard'
    CHECK (urgency_default IN ('standard', 'priority', 'emergency')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS pm_move_reasons_global_code
  ON public.pm_move_reasons (reason_code) WHERE partner_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pm_move_reasons_partner_code
  ON public.pm_move_reasons (partner_id, reason_code) WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pm_move_reasons_partner ON public.pm_move_reasons (partner_id) WHERE active = TRUE;

-- Partner disables a global reason without duplicating rows
CREATE TABLE IF NOT EXISTS public.pm_partner_move_reason_disable (
  partner_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (partner_id, reason_code)
);

-- Optional: restrict which global reasons apply to a contract (empty = all globals minus disables + customs)
CREATE TABLE IF NOT EXISTS public.pm_contract_reason_codes (
  contract_id UUID NOT NULL REFERENCES public.partner_contracts(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (contract_id, reason_code)
);

-- Rate matrix (replaces reliance on JSON for new contracts; legacy JSON still supported in app)
CREATE TABLE IF NOT EXISTS public.pm_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.partner_contracts(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  unit_size TEXT NOT NULL,
  zone TEXT NOT NULL DEFAULT 'local' CHECK (zone IN (
    'same_building', 'local', 'within_region', 'to_from_toronto', 'outside_gta'
  )),
  base_rate NUMERIC NOT NULL,
  weekend_surcharge NUMERIC NOT NULL DEFAULT 150,
  after_hours_premium NUMERIC NOT NULL DEFAULT 0.20,
  holiday_surcharge NUMERIC NOT NULL DEFAULT 200,
  crew_count INTEGER,
  truck_type TEXT,
  estimated_hours NUMERIC,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, reason_code, unit_size, zone)
);

CREATE INDEX IF NOT EXISTS idx_pm_rate_cards_contract ON public.pm_rate_cards (contract_id) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS public.pm_contract_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.partner_contracts(id) ON DELETE CASCADE,
  addon_code TEXT NOT NULL,
  label TEXT NOT NULL,
  price NUMERIC NOT NULL,
  price_type TEXT NOT NULL DEFAULT 'flat' CHECK (price_type IN (
    'flat', 'per_unit', 'per_room', 'per_item', 'percentage'
  )),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (contract_id, addon_code)
);

CREATE INDEX IF NOT EXISTS idx_pm_contract_addons_contract ON public.pm_contract_addons (contract_id) WHERE active = TRUE;

ALTER TABLE public.partner_properties
  ADD COLUMN IF NOT EXISTS service_region TEXT NOT NULL DEFAULT 'gta';

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS pm_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS pm_project_id UUID,
  ADD COLUMN IF NOT EXISTS pm_parent_move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pm_zone TEXT,
  ADD COLUMN IF NOT EXISTS pm_urgency TEXT;

CREATE INDEX IF NOT EXISTS idx_moves_pm_project ON public.moves (pm_project_id) WHERE pm_project_id IS NOT NULL;

-- Generic projects (migrate from renovation_*)
CREATE TABLE IF NOT EXISTS public.pm_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.partner_contracts(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.partner_properties(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'other' CHECK (project_type IN (
    'renovation', 'building_upgrade', 'tenant_turnover',
    'office_buildout', 'flood_remediation', 'staging_campaign',
    'lease_up', 'other'
  )),
  total_units INTEGER,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_projects_partner ON public.pm_projects (partner_id);

CREATE TABLE IF NOT EXISTS public.pm_project_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  unit_type TEXT,
  tenant_name TEXT,
  tenant_phone TEXT,
  tenant_email TEXT,
  outbound_move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  outbound_date DATE,
  return_move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  return_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'outbound_scheduled', 'outbound_complete',
    'in_progress', 'return_scheduled', 'return_complete', 'complete'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_project_units_project ON public.pm_project_units (project_id);

-- Migrate renovation tables if present
DO $mig$
BEGIN
  IF to_regclass('public.renovation_projects') IS NOT NULL THEN
    INSERT INTO public.pm_projects (
      id, partner_id, contract_id, property_id, project_name, project_type,
      total_units, start_date, end_date, status, notes, created_at
    )
    SELECT
      id, partner_id, contract_id, property_id, project_name, 'renovation',
      total_units, start_date, end_date, status, NULL::text, created_at
    FROM public.renovation_projects
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.pm_project_units (
      id, project_id, unit_number, unit_type, tenant_name, tenant_phone, tenant_email,
      outbound_move_id, outbound_date, return_move_id, return_date, status, notes, created_at
    )
    SELECT
      ru.id,
      ru.project_id,
      ru.unit_number,
      ru.unit_type,
      ru.tenant_name,
      ru.tenant_phone,
      ru.tenant_email,
      ru.move_out_move_id,
      ru.move_out_date,
      ru.move_in_move_id,
      ru.move_in_date,
      CASE ru.status
        WHEN 'pending' THEN 'pending'
        WHEN 'move_out_scheduled' THEN 'outbound_scheduled'
        WHEN 'moved_out' THEN 'outbound_complete'
        WHEN 'in_renovation' THEN 'in_progress'
        WHEN 'reno_complete' THEN 'in_progress'
        WHEN 'move_in_scheduled' THEN 'return_scheduled'
        WHEN 'moved_in' THEN 'return_complete'
        WHEN 'complete' THEN 'complete'
        ELSE 'pending'
      END,
      ru.notes,
      ru.created_at
    FROM public.renovation_units ru
    ON CONFLICT (id) DO NOTHING;

    DROP TABLE IF EXISTS public.renovation_units CASCADE;
    DROP TABLE IF EXISTS public.renovation_projects CASCADE;
  END IF;
END$mig$;

-- FK from moves.pm_project_id (defer until pm_projects exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'moves_pm_project_id_fkey'
  ) THEN
    ALTER TABLE public.moves
      ADD CONSTRAINT moves_pm_project_id_fkey
      FOREIGN KEY (pm_project_id) REFERENCES public.pm_projects(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- Seed global move reasons (idempotent)
INSERT INTO public.pm_move_reasons (partner_id, reason_code, label, description, is_round_trip, default_origin, default_destination, requires_return_move, urgency_default, sort_order)
SELECT NULL, v.reason_code, v.label, v.description, v.is_round_trip, v.default_origin, v.default_destination, v.requires_return_move, v.urgency_default, v.sort_order
FROM (VALUES
  ('tenant_move_in', 'Tenant Move-In', 'New tenant moving into a unit', false, 'external', 'unit', false, 'standard', 10),
  ('tenant_move_out', 'Tenant Move-Out', 'Tenant vacating a unit', false, 'unit', 'external', false, 'standard', 20),
  ('reno_move_out', 'Renovation Move-Out', 'Relocating during renovation', false, 'unit', 'storage', true, 'standard', 30),
  ('reno_move_in', 'Renovation Move-In', 'Returning after renovation', false, 'storage', 'unit', false, 'standard', 40),
  ('unit_turnover', 'Unit Turnover', 'Clearing unit between tenants', false, 'unit', 'storage', false, 'standard', 50),
  ('emergency_relocation', 'Emergency Relocation', 'Flood, fire, or damage displacement', false, 'unit', 'custom', true, 'emergency', 60),
  ('suite_transfer', 'Suite Transfer', 'Between units in the same building', false, 'unit', 'unit', false, 'standard', 70),
  ('building_transfer', 'Building Transfer', 'Between buildings', false, 'unit', 'unit', false, 'standard', 80),
  ('storage_move', 'Storage Move', 'Items to or from storage', false, 'custom', 'storage', false, 'standard', 90),
  ('office_suite_setup', 'Office Suite Setup', 'Commercial tenant office setup', false, 'external', 'unit', false, 'standard', 100),
  ('office_suite_clearout', 'Office Suite Clearout', 'Commercial tenant vacating', false, 'unit', 'external', false, 'standard', 110),
  ('incentive_move', 'Tenant Incentive Move', 'Free or subsidized move (leasing perk)', false, 'external', 'unit', false, 'standard', 120),
  ('staging', 'Unit Staging', 'Furniture in for showing/staging', false, 'storage', 'unit', true, 'standard', 130),
  ('destaging', 'Unit Destaging', 'Remove staging furniture', false, 'unit', 'storage', false, 'standard', 140),
  ('common_area', 'Common Area Move', 'Lobby, gym, amenity furniture', false, 'custom', 'custom', false, 'standard', 150),
  ('other', 'Other', 'Custom move — specify in instructions', false, 'custom', 'custom', false, 'standard', 999)
) AS v(reason_code, label, description, is_round_trip, default_origin, default_destination, requires_return_move, urgency_default, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pm_move_reasons g WHERE g.partner_id IS NULL AND g.reason_code = v.reason_code
);

-- RLS
ALTER TABLE public.pm_move_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_partner_move_reason_disable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_contract_reason_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_contract_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_project_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users manage pm_move_reasons" ON public.pm_move_reasons;
CREATE POLICY "Platform users manage pm_move_reasons"
  ON public.pm_move_reasons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner read global pm_move_reasons" ON public.pm_move_reasons;
CREATE POLICY "Partner read global pm_move_reasons"
  ON public.pm_move_reasons FOR SELECT TO authenticated
  USING (partner_id IS NULL AND active = TRUE);

DROP POLICY IF EXISTS "Partner read own pm_move_reasons" ON public.pm_move_reasons;
CREATE POLICY "Partner read own pm_move_reasons"
  ON public.pm_move_reasons FOR SELECT TO authenticated
  USING (
    partner_id IS NOT NULL
    AND active = TRUE
    AND partner_id IN (SELECT pu.org_id FROM public.partner_users pu WHERE pu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Platform users manage pm_partner_move_reason_disable" ON public.pm_partner_move_reason_disable;
CREATE POLICY "Platform users manage pm_partner_move_reason_disable"
  ON public.pm_partner_move_reason_disable FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner read own pm_partner_move_reason_disable" ON public.pm_partner_move_reason_disable;
CREATE POLICY "Partner read own pm_partner_move_reason_disable"
  ON public.pm_partner_move_reason_disable FOR SELECT TO authenticated
  USING (partner_id IN (SELECT pu.org_id FROM public.partner_users pu WHERE pu.user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users manage pm_contract_reason_codes" ON public.pm_contract_reason_codes;
CREATE POLICY "Platform users manage pm_contract_reason_codes"
  ON public.pm_contract_reason_codes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner read pm_contract_reason_codes" ON public.pm_contract_reason_codes;
CREATE POLICY "Partner read pm_contract_reason_codes"
  ON public.pm_contract_reason_codes FOR SELECT TO authenticated
  USING (
    contract_id IN (
      SELECT pc.id FROM public.partner_contracts pc
      JOIN public.partner_users pu ON pu.org_id = pc.partner_id AND pu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform users manage pm_rate_cards" ON public.pm_rate_cards;
CREATE POLICY "Platform users manage pm_rate_cards"
  ON public.pm_rate_cards FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner read pm_rate_cards" ON public.pm_rate_cards;
CREATE POLICY "Partner read pm_rate_cards"
  ON public.pm_rate_cards FOR SELECT TO authenticated
  USING (
    contract_id IN (
      SELECT pc.id FROM public.partner_contracts pc
      JOIN public.partner_users pu ON pu.org_id = pc.partner_id AND pu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform users manage pm_contract_addons" ON public.pm_contract_addons;
CREATE POLICY "Platform users manage pm_contract_addons"
  ON public.pm_contract_addons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner read pm_contract_addons" ON public.pm_contract_addons;
CREATE POLICY "Partner read pm_contract_addons"
  ON public.pm_contract_addons FOR SELECT TO authenticated
  USING (
    contract_id IN (
      SELECT pc.id FROM public.partner_contracts pc
      JOIN public.partner_users pu ON pu.org_id = pc.partner_id AND pu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Platform users manage pm_projects" ON public.pm_projects;
CREATE POLICY "Platform users manage pm_projects"
  ON public.pm_projects FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner read own pm_projects" ON public.pm_projects;
CREATE POLICY "Partner read own pm_projects"
  ON public.pm_projects FOR SELECT TO authenticated
  USING (partner_id IN (SELECT pu.org_id FROM public.partner_users pu WHERE pu.user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users manage pm_project_units" ON public.pm_project_units;
CREATE POLICY "Platform users manage pm_project_units"
  ON public.pm_project_units FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner read pm_project_units" ON public.pm_project_units;
CREATE POLICY "Partner read pm_project_units"
  ON public.pm_project_units FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pm_projects pp
      JOIN public.partner_users pu ON pu.org_id = pp.partner_id AND pu.user_id = auth.uid()
      WHERE pp.id = pm_project_units.project_id
    )
  );
