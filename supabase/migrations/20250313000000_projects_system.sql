-- Projects system for coordinating complex multi-delivery B2B engagements

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number TEXT NOT NULL UNIQUE,
  partner_id UUID NOT NULL REFERENCES public.organizations(id),
  project_name TEXT NOT NULL,
  description TEXT,
  end_client_name TEXT,
  end_client_contact TEXT,
  site_address TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'proposed', 'active', 'on_hold',
    'completed', 'invoiced', 'cancelled'
  )),
  active_phase TEXT,
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  estimated_budget NUMERIC,
  project_mgmt_fee NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  project_lead UUID REFERENCES auth.users(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_name TEXT NOT NULL,
  description TEXT,
  phase_order INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'completed', 'skipped'
  )),
  scheduled_date DATE,
  completed_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS
  project_id UUID REFERENCES public.projects(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS
  phase_id UUID REFERENCES public.project_phases(id);

CREATE TABLE IF NOT EXISTS public.project_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES public.project_phases(id),
  item_name TEXT NOT NULL,
  description TEXT,
  vendor TEXT,
  quantity INTEGER DEFAULT 1,
  received_date DATE,
  received_by TEXT,
  condition_on_receipt TEXT CHECK (condition_on_receipt IN (
    'perfect', 'minor_damage', 'major_damage', 'missing'
  )),
  inspection_notes TEXT,
  photo_urls TEXT[],
  storage_location TEXT,
  status TEXT DEFAULT 'expected' CHECK (status IN (
    'expected', 'received', 'inspected', 'stored',
    'scheduled_for_delivery', 'delivered', 'installed',
    'returned', 'damaged'
  )),
  delivered_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_description TEXT NOT NULL,
  phase_id UUID REFERENCES public.project_phases(id),
  user_id UUID REFERENCES auth.users(id),
  photos TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_partner_id ON public.projects(partner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON public.project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_inventory_project_id ON public.project_inventory(project_id);
CREATE INDEX IF NOT EXISTS idx_project_timeline_project_id ON public.project_timeline(project_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_project_id ON public.deliveries(project_id);
