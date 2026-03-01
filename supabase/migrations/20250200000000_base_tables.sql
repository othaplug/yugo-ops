-- Base tables that were created before the migration system was adopted.
-- Using IF NOT EXISTS so this is safe to run on existing databases.

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'b2c',
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  members text[] DEFAULT '{}',
  status text DEFAULT 'available',
  current_lat double precision,
  current_lng double precision,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  move_code text,
  move_number integer,
  client_name text,
  client_email text,
  client_phone text,
  organization_id uuid REFERENCES public.organizations(id),
  crew_id uuid REFERENCES public.crews(id),
  status text DEFAULT 'pending',
  stage text,
  next_action text,
  scheduled_date date,
  scheduled_time text,
  from_address text,
  to_address text,
  from_lat double precision,
  from_lng double precision,
  to_lat double precision,
  to_lng double precision,
  move_type text DEFAULT 'residential',
  complexity text DEFAULT 'standard',
  internal_notes text,
  delivery_address text,
  estimated_hours numeric,
  rate numeric,
  amount numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_number text,
  customer_name text,
  client_name text,
  organization_id uuid REFERENCES public.organizations(id),
  crew_id uuid REFERENCES public.crews(id),
  status text DEFAULT 'pending',
  stage text,
  next_action text,
  scheduled_date date,
  time_slot text,
  pickup_address text,
  delivery_address text,
  items jsonb DEFAULT '[]',
  category text,
  special_handling text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text,
  move_id uuid REFERENCES public.moves(id),
  organization_id uuid REFERENCES public.organizations(id),
  client_name text,
  amount numeric DEFAULT 0,
  status text DEFAULT 'draft',
  due_date date,
  file_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  client_name text,
  client_email text,
  property text,
  tier text DEFAULT 'standard',
  status text DEFAULT 'new',
  commission numeric DEFAULT 0,
  move_type text,
  organization_id uuid REFERENCES public.organizations(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on base tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Service role bypass for all base tables
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_organizations') THEN
    CREATE POLICY service_role_organizations ON public.organizations FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_crews') THEN
    CREATE POLICY service_role_crews ON public.crews FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_moves') THEN
    CREATE POLICY service_role_moves ON public.moves FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_deliveries') THEN
    CREATE POLICY service_role_deliveries ON public.deliveries FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_invoices') THEN
    CREATE POLICY service_role_invoices ON public.invoices FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_referrals') THEN
    CREATE POLICY service_role_referrals ON public.referrals FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Enable realtime on base tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crews;
ALTER PUBLICATION supabase_realtime ADD TABLE public.moves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
