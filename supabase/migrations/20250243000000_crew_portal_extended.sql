-- Crew Portal Extended: iPad registration, job photos, sign-off, readiness, expenses, extra items, EOD reports

-- 0. Support 4-digit PIN for iPad flow (optional, crew_members can use 4 or 6 digit)
ALTER TABLE public.crew_members ADD COLUMN IF NOT EXISTS pin_length SMALLINT DEFAULT 6;

-- 1. Trucks (fleet vehicles for iPad assignment)
CREATE TABLE IF NOT EXISTS public.trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Setup codes (one-time codes for iPad registration, admin creates)
CREATE TABLE IF NOT EXISTS public.device_setup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE,
  default_team_id UUID REFERENCES public.crews(id) ON DELETE CASCADE,
  device_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_device_setup_codes_code ON public.device_setup_codes (code);

-- 3. Registered devices (iPad registration)
CREATE TABLE IF NOT EXISTS public.registered_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name TEXT NOT NULL,
  device_id TEXT UNIQUE NOT NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  default_team_id UUID REFERENCES public.crews(id) ON DELETE SET NULL,
  registered_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registered_devices_truck ON public.registered_devices (truck_id);
CREATE INDEX IF NOT EXISTS idx_registered_devices_team ON public.registered_devices (default_team_id);

-- RLS for device_setup_codes (admin only)
ALTER TABLE public.device_setup_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform users manage device_setup_codes" ON public.device_setup_codes;
CREATE POLICY "Platform users manage device_setup_codes"
  ON public.device_setup_codes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- 4. Truck assignments (which team is assigned to which truck today - admin scheduling)
CREATE TABLE IF NOT EXISTS public.truck_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(truck_id, date)
);
CREATE INDEX IF NOT EXISTS idx_truck_assignments_date ON public.truck_assignments (date);

-- 5. Job photos (crew-captured at checkpoints)
CREATE TYPE photo_category AS ENUM (
  'pre_move_condition',
  'loading',
  'in_transit',
  'delivery_placement',
  'post_move_condition',
  'damage_documentation',
  'other'
);

CREATE TABLE IF NOT EXISTS public.job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('move', 'delivery')),
  session_id UUID REFERENCES public.tracking_sessions(id) ON DELETE SET NULL,
  checkpoint TEXT,
  category photo_category NOT NULL DEFAULT 'other',
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  taken_by UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  taken_at TIMESTAMPTZ DEFAULT now(),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_client_visible BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_photos_job ON public.job_photos (job_id, job_type);
CREATE INDEX IF NOT EXISTS idx_job_photos_session ON public.job_photos (session_id);

-- 6. Client sign-offs
CREATE TABLE IF NOT EXISTS public.client_sign_offs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('move', 'delivery')),
  signed_by TEXT NOT NULL,
  signature_data_url TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT now(),
  all_items_received BOOLEAN NOT NULL DEFAULT true,
  condition_accepted BOOLEAN NOT NULL DEFAULT true,
  satisfaction_rating SMALLINT CHECK (satisfaction_rating BETWEEN 1 AND 5),
  exceptions TEXT,
  would_recommend BOOLEAN,
  feedback_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_sign_offs_job ON public.client_sign_offs (job_id, job_type);

-- 7. Readiness checks
CREATE TABLE IF NOT EXISTS public.readiness_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  crew_lead_id UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  check_date DATE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  items JSONB NOT NULL DEFAULT '[]',
  passed BOOLEAN NOT NULL DEFAULT true,
  flagged_items TEXT[] DEFAULT '{}',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_readiness_checks_team_date ON public.readiness_checks (team_id, check_date);

-- 8. Crew expenses
CREATE TYPE expense_category AS ENUM ('parking', 'supplies', 'fuel', 'tolls', 'food', 'other');
CREATE TYPE expense_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS public.crew_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT,
  team_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL,
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  receipt_storage_path TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  status expense_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crew_expenses_team ON public.crew_expenses (team_id);
CREATE INDEX IF NOT EXISTS idx_crew_expenses_job ON public.crew_expenses (job_id);

-- 9. Extra items (added on-site)
CREATE TABLE IF NOT EXISTS public.extra_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  added_by UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  room TEXT,
  quantity INT DEFAULT 1,
  added_at TIMESTAMPTZ DEFAULT now(),
  photo_storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_extra_items_job ON public.extra_items (job_id);

-- 10. End of day reports
CREATE TABLE IF NOT EXISTS public.end_of_day_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  crew_lead_id UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  summary JSONB NOT NULL DEFAULT '{}',
  jobs JSONB NOT NULL DEFAULT '[]',
  readiness JSONB,
  expenses JSONB DEFAULT '[]',
  crew_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_end_of_day_reports_team_date ON public.end_of_day_reports (team_id, report_date);

-- Storage bucket for crew job photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Platform users manage job photos storage
DROP POLICY IF EXISTS "Platform users manage job photos storage" ON storage.objects;
CREATE POLICY "Platform users manage job photos storage"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'job-photos'
    AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );

-- RLS for new tables (crew uses service role for API, so these protect direct DB access)
ALTER TABLE public.registered_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truck_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_sign_offs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.end_of_day_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users manage registered_devices" ON public.registered_devices;
CREATE POLICY "Platform users manage registered_devices"
  ON public.registered_devices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users manage truck_assignments" ON public.truck_assignments;
CREATE POLICY "Platform users manage truck_assignments"
  ON public.truck_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users manage job_photos" ON public.job_photos;
CREATE POLICY "Platform users manage job_photos"
  ON public.job_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users manage client_sign_offs" ON public.client_sign_offs;
CREATE POLICY "Platform users manage client_sign_offs"
  ON public.client_sign_offs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users manage readiness_checks" ON public.readiness_checks;
CREATE POLICY "Platform users manage readiness_checks"
  ON public.readiness_checks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users manage crew_expenses" ON public.crew_expenses;
CREATE POLICY "Platform users manage crew_expenses"
  ON public.crew_expenses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users manage extra_items" ON public.extra_items;
CREATE POLICY "Platform users manage extra_items"
  ON public.extra_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Platform users manage end_of_day_reports" ON public.end_of_day_reports;
CREATE POLICY "Platform users manage end_of_day_reports"
  ON public.end_of_day_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
