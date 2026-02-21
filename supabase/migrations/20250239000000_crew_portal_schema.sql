-- Crew Portal: crew_members (phone+PIN auth), tracking_sessions, checkpoints, location_updates
-- Also: ensure deliveries have crew_id; migrate delivery_number DEL- to PJ

-- 1. Add crew_id to deliveries if not exists (for crew assignment)
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_crew_id ON public.deliveries (crew_id);

-- 2. Migrate existing delivery_number from DEL-xxxx to PJxxxx
UPDATE public.deliveries
SET delivery_number = 'PJ' || LPAD(COALESCE(SUBSTRING(delivery_number FROM '[0-9]+'), '0'), 4, '0')
WHERE delivery_number LIKE 'DEL-%' AND delivery_number ~ '^DEL-[0-9]+$';

-- 3. Crew members (phone + PIN login)
CREATE TABLE IF NOT EXISTS public.crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('lead', 'specialist', 'driver')),
  team_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  avatar_initials TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phone)
);
CREATE INDEX IF NOT EXISTS idx_crew_members_team_id ON public.crew_members (team_id);
CREATE INDEX IF NOT EXISTS idx_crew_members_phone ON public.crew_members (phone);

-- 4. Tracking sessions (one per job)
CREATE TYPE tracking_status AS ENUM (
  'not_started',
  'en_route_to_pickup',
  'arrived_at_pickup',
  'loading',
  'en_route_to_destination',
  'arrived_at_destination',
  'unloading',
  'completed'
);

CREATE TABLE IF NOT EXISTS public.tracking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('move', 'delivery')),
  team_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  crew_lead_id UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started',
  is_active BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_location JSONB,
  checkpoints JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_job ON public.tracking_sessions (job_id, job_type);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_team ON public.tracking_sessions (team_id);
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_active ON public.tracking_sessions (is_active) WHERE is_active = true;

-- 5. Location updates (GPS breadcrumb trail)
CREATE TABLE IF NOT EXISTS public.location_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.tracking_sessions(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_location_updates_session ON public.location_updates (session_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_timestamp ON public.location_updates (session_id, timestamp DESC);

-- 6. RLS for crew_members, tracking_sessions, location_updates
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;

-- Platform users (admin) can manage crew members
DROP POLICY IF EXISTS "Platform users manage crew_members" ON public.crew_members;
CREATE POLICY "Platform users manage crew_members"
  ON public.crew_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- Platform users manage tracking sessions
DROP POLICY IF EXISTS "Platform users manage tracking_sessions" ON public.tracking_sessions;
CREATE POLICY "Platform users manage tracking_sessions"
  ON public.tracking_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- Platform users manage location updates
DROP POLICY IF EXISTS "Platform users manage location_updates" ON public.location_updates;
CREATE POLICY "Platform users manage location_updates"
  ON public.location_updates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
