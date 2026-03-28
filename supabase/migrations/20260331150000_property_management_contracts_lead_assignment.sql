-- Lead assignment fields (on platform_users — not auth.users)
ALTER TABLE public.platform_users
  ADD COLUMN IF NOT EXISTS specializations TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS on_vacation BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS out_of_office BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_open_leads INTEGER NOT NULL DEFAULT 20;

INSERT INTO public.platform_config (key, value, description)
VALUES (
  'lead_assignment_mode',
  'smart',
  'Lead auto-assignment: round_robin | smart | manual'
)
ON CONFLICT (key) DO NOTHING;

-- Property management: buildings / portfolio
CREATE TABLE IF NOT EXISTS public.partner_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  building_name TEXT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT,
  total_units INTEGER,
  unit_types TEXT[],
  has_loading_dock BOOLEAN NOT NULL DEFAULT FALSE,
  has_move_elevator BOOLEAN NOT NULL DEFAULT FALSE,
  elevator_type TEXT,
  move_hours TEXT,
  parking_type TEXT,
  building_contact_name TEXT,
  building_contact_phone TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_properties_partner
  ON public.partner_properties (partner_id) WHERE active = TRUE;

-- Contracts (rate card, terms) — partner_id = organizations.id
CREATE TABLE IF NOT EXISTS public.partner_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL UNIQUE,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('per_move', 'fixed_rate', 'day_rate_retainer')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  rate_card JSONB,
  days_per_week INTEGER,
  day_rate NUMERIC,
  estimated_annual_value NUMERIC,
  estimated_total_value NUMERIC,
  payment_terms TEXT NOT NULL DEFAULT 'net_30',
  cancellation_notice_days INTEGER NOT NULL DEFAULT 30,
  rate_lock_months INTEGER NOT NULL DEFAULT 12,
  tenant_comms_by TEXT NOT NULL DEFAULT 'partner'
    CHECK (tenant_comms_by IN ('partner', 'yugo')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'proposed', 'negotiating', 'active',
    'paused', 'expired', 'cancelled'
  )),
  signed_at TIMESTAMPTZ,
  signed_by TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_contracts_partner
  ON public.partner_contracts (partner_id, status);

-- Renovation program tracking
CREATE TABLE IF NOT EXISTS public.renovation_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.partner_contracts(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.partner_properties(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL,
  total_units INTEGER NOT NULL,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renovation_projects_partner
  ON public.renovation_projects (partner_id);

CREATE TABLE IF NOT EXISTS public.renovation_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.renovation_projects(id) ON DELETE CASCADE,
  unit_number TEXT NOT NULL,
  unit_type TEXT,
  tenant_name TEXT,
  tenant_phone TEXT,
  tenant_email TEXT,
  move_out_date DATE,
  move_out_move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  reno_start_date DATE,
  reno_end_date DATE,
  move_in_date DATE,
  move_in_move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  storage_location TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'move_out_scheduled', 'moved_out',
    'in_renovation', 'reno_complete',
    'move_in_scheduled', 'moved_in', 'complete'
  )),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renovation_units_project
  ON public.renovation_units (project_id);

-- Moves linked to PM contracts / buildings / tenants
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.partner_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_property_id UUID REFERENCES public.partner_properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_number TEXT,
  ADD COLUMN IF NOT EXISTS tenant_name TEXT,
  ADD COLUMN IF NOT EXISTS tenant_phone TEXT,
  ADD COLUMN IF NOT EXISTS tenant_email TEXT,
  ADD COLUMN IF NOT EXISTS pm_move_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_moves_contract_id ON public.moves (contract_id) WHERE contract_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_moves_partner_property ON public.moves (partner_property_id) WHERE partner_property_id IS NOT NULL;

-- RLS
ALTER TABLE public.partner_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renovation_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renovation_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users manage partner_properties" ON public.partner_properties;
CREATE POLICY "Platform users manage partner_properties"
  ON public.partner_properties FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner read own partner_properties" ON public.partner_properties;
CREATE POLICY "Partner read own partner_properties"
  ON public.partner_properties FOR SELECT TO authenticated
  USING (
    partner_id IN (SELECT pu.org_id FROM public.partner_users pu WHERE pu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Platform users manage partner_contracts" ON public.partner_contracts;
CREATE POLICY "Platform users manage partner_contracts"
  ON public.partner_contracts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner read own partner_contracts" ON public.partner_contracts;
CREATE POLICY "Partner read own partner_contracts"
  ON public.partner_contracts FOR SELECT TO authenticated
  USING (
    partner_id IN (SELECT pu.org_id FROM public.partner_users pu WHERE pu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Platform users manage renovation_projects" ON public.renovation_projects;
CREATE POLICY "Platform users manage renovation_projects"
  ON public.renovation_projects FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner read own renovation_projects" ON public.renovation_projects;
CREATE POLICY "Partner read own renovation_projects"
  ON public.renovation_projects FOR SELECT TO authenticated
  USING (
    partner_id IN (SELECT pu.org_id FROM public.partner_users pu WHERE pu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Platform users manage renovation_units" ON public.renovation_units;
CREATE POLICY "Platform users manage renovation_units"
  ON public.renovation_units FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partner read renovation_units via project" ON public.renovation_units;
CREATE POLICY "Partner read renovation_units via project"
  ON public.renovation_units FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.renovation_projects rp
      JOIN public.partner_users pu ON pu.org_id = rp.partner_id AND pu.user_id = auth.uid()
      WHERE rp.id = renovation_units.project_id
    )
  );
