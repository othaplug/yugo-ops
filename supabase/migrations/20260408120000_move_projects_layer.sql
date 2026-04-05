-- Multi-day residential/office move projects (distinct from B2B public.projects / project_phases)

CREATE TABLE IF NOT EXISTS public.move_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,

  project_name TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'residential_standard',
  office_profile JSONB DEFAULT '{}',
  multi_home_move_type TEXT,

  start_date DATE NOT NULL,
  end_date DATE,
  total_days INTEGER NOT NULL DEFAULT 1,

  origins JSONB NOT NULL DEFAULT '[]',
  destinations JSONB NOT NULL DEFAULT '[]',

  total_price NUMERIC,
  deposit NUMERIC,
  payment_schedule JSONB DEFAULT '[]',

  status TEXT NOT NULL DEFAULT 'draft',

  coordinator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  coordinator_name TEXT,

  special_instructions TEXT,
  internal_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.move_project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.move_projects(id) ON DELETE CASCADE,

  phase_number INTEGER NOT NULL,
  phase_name TEXT NOT NULL,
  phase_type TEXT NOT NULL,

  start_date DATE,
  end_date DATE,

  origin_index INTEGER,
  destination_index INTEGER,

  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',

  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.move_project_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.move_projects(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES public.move_project_phases(id) ON DELETE CASCADE,

  day_number INTEGER NOT NULL,
  date DATE NOT NULL,

  day_type TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,

  crew_size INTEGER NOT NULL DEFAULT 2,
  crew_ids UUID[],
  truck_type TEXT,
  truck_count INTEGER NOT NULL DEFAULT 1,
  estimated_hours NUMERIC,

  origin_address TEXT,
  destination_address TEXT,

  arrival_window TEXT,
  start_time TIME,
  end_time TIME,

  day_cost_estimate NUMERIC,

  status TEXT NOT NULL DEFAULT 'scheduled',

  completion_notes TEXT,
  issues TEXT,

  move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.move_project_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.move_projects(id) ON DELETE CASCADE,
  comm_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  subject TEXT,
  body_preview TEXT,
  recipient_kind TEXT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS move_project_id UUID REFERENCES public.move_projects(id) ON DELETE SET NULL;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS move_project_id UUID REFERENCES public.move_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_move_projects_quote_id ON public.move_projects(quote_id);
CREATE INDEX IF NOT EXISTS idx_move_projects_contact_id ON public.move_projects(contact_id);
CREATE INDEX IF NOT EXISTS idx_move_projects_status ON public.move_projects(status);
CREATE INDEX IF NOT EXISTS idx_move_projects_start_date ON public.move_projects(start_date);
CREATE INDEX IF NOT EXISTS idx_move_project_phases_project_id ON public.move_project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_move_project_days_project_id ON public.move_project_days(project_id);
CREATE INDEX IF NOT EXISTS idx_move_project_days_phase_id ON public.move_project_days(phase_id);
CREATE INDEX IF NOT EXISTS idx_move_project_days_date ON public.move_project_days(date);
CREATE INDEX IF NOT EXISTS idx_move_project_days_move_id ON public.move_project_days(move_id);
CREATE INDEX IF NOT EXISTS idx_move_project_comms_project_id ON public.move_project_communications(project_id);
CREATE INDEX IF NOT EXISTS idx_quotes_move_project_id ON public.quotes(move_project_id);
CREATE INDEX IF NOT EXISTS idx_moves_move_project_id ON public.moves(move_project_id);

DO $$ BEGIN
  CREATE TRIGGER set_move_projects_updated_at
    BEFORE UPDATE ON public.move_projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.move_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_project_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_project_communications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "staff_manage_move_projects" ON public.move_projects
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff_manage_move_project_phases" ON public.move_project_phases
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff_manage_move_project_days" ON public.move_project_days
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff_manage_move_project_communications" ON public.move_project_communications
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
