-- Repair: some environments never applied 20260328000000_b2b_tracking_equipment.sql
-- (or drifted). PostgREST returns "Could not find the table public.equipment_inventory
-- in the schema cache" when the table is missing. This migration is fully idempotent.

-- Equipment master list
CREATE TABLE IF NOT EXISTS public.equipment_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN (
    'protection', 'tools', 'moving', 'supplies', 'tech'
  )),
  icon TEXT,
  default_quantity INTEGER NOT NULL DEFAULT 1,
  replacement_cost NUMERIC,
  is_consumable BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_inventory_category ON public.equipment_inventory (category);
CREATE INDEX IF NOT EXISTS idx_equipment_inventory_active ON public.equipment_inventory (active) WHERE active = true;

-- Per-truck quantities (aligned with fleet_vehicles after 20260401120100; public.trucks may be dropped)
CREATE TABLE IF NOT EXISTS public.truck_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipment_inventory(id) ON DELETE CASCADE,
  assigned_quantity INTEGER NOT NULL,
  current_quantity INTEGER NOT NULL,
  last_checked TIMESTAMPTZ,
  last_checked_by TEXT,
  UNIQUE (truck_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS idx_truck_equipment_truck ON public.truck_equipment (truck_id);

-- Post-job equipment check (one row per submit or skip)
CREATE TABLE IF NOT EXISTS public.equipment_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('move', 'delivery')),
  job_id UUID NOT NULL,
  truck_id UUID REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL,
  crew_lead_id UUID REFERENCES public.crew_members(id) ON DELETE SET NULL,
  skip_reason TEXT CHECK (skip_reason IS NULL OR skip_reason IN ('labour_only', 'emergency_later')),
  skip_notes TEXT,
  shortage_batch_reason TEXT CHECK (shortage_batch_reason IS NULL OR shortage_batch_reason IN (
    'left_at_client', 'damaged', 'lost', 'consumed'
  )),
  left_at_client_will_retrieve BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (job_type, job_id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_checks_job ON public.equipment_checks (job_type, job_id);

CREATE TABLE IF NOT EXISTS public.equipment_check_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES public.equipment_checks(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.equipment_inventory(id) ON DELETE CASCADE,
  expected_quantity INTEGER NOT NULL,
  actual_quantity INTEGER NOT NULL,
  UNIQUE (check_id, equipment_id)
);

-- Incidents / loss history (one row per equipment line with actionable shortage)
CREATE TABLE IF NOT EXISTS public.equipment_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  equipment_check_id UUID REFERENCES public.equipment_checks(id) ON DELETE SET NULL,
  truck_id UUID REFERENCES public.fleet_vehicles(id) ON DELETE SET NULL,
  crew_lead_id UUID REFERENCES public.crew_members(id) ON DELETE SET NULL,
  equipment_id UUID NOT NULL REFERENCES public.equipment_inventory(id) ON DELETE CASCADE,
  expected_quantity INTEGER NOT NULL,
  actual_quantity INTEGER NOT NULL,
  shortage INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'left_at_client', 'damaged', 'lost', 'consumed'
  )),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_notes TEXT,
  replacement_cost NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_incidents_created ON public.equipment_incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_equipment_incidents_truck ON public.equipment_incidents (truck_id);

-- Square webhook idempotency (payment.updated etc.)
CREATE TABLE IF NOT EXISTS public.webhook_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_idempotency_created ON public.webhook_idempotency_keys (created_at DESC);

-- Seed equipment (idempotent)
INSERT INTO public.equipment_inventory (name, category, icon, default_quantity, replacement_cost, is_consumable) VALUES
 ('Moving blankets (quilted)', 'protection', 'Stack', 12, 25, false),
 ('Furniture pads', 'protection', 'Armchair', 6, 15, false),
 ('Floor runners (rolls)', 'protection', 'Ruler', 2, 30, false),
 ('Door frame guards', 'protection', 'Door', 4, 20, false),
 ('Door stoppers', 'protection', 'Cube', 4, 8, false),
 ('Mattress bags', 'protection', 'Bed', 2, 5, true),
 ('Shrink wrap (rolls)', 'protection', 'Spiral', 2, 12, true),
 ('Bubble wrap (rolls)', 'protection', 'CirclesThree', 1, 15, true),
 ('Furniture dolly', 'moving', 'ShoppingCart', 1, 120, false),
 ('Appliance dolly', 'moving', 'Truck', 1, 180, false),
 ('Flat dolly', 'moving', 'Package', 2, 80, false),
 ('Hand truck', 'moving', 'HandGrabbing', 1, 90, false),
 ('Ratchet straps', 'moving', 'Link', 6, 15, false),
 ('Bungee cords', 'moving', 'Infinity', 4, 5, false),
 ('Screwdriver set', 'tools', 'Wrench', 1, 30, false),
 ('Allen key set', 'tools', 'Hexagon', 1, 15, false),
 ('Wrench set', 'tools', 'Nut', 1, 25, false),
 ('Box cutter', 'tools', 'Knife', 2, 5, false),
 ('Tape gun', 'tools', 'Tape', 2, 10, false),
 ('Tape rolls', 'supplies', 'Scroll', 4, 3, true),
 ('Packing paper (sheets)', 'supplies', 'FileText', 50, 0.10, true),
 ('Labels + markers', 'supplies', 'Tag', 1, 5, false),
 ('iPad (crew portal)', 'tech', 'DeviceTablet', 1, 500, false),
 ('Phone charger', 'tech', 'Charging', 1, 20, false)
ON CONFLICT (name) DO NOTHING;

-- RLS: staff-only via platform_users; crew uses service role in API
ALTER TABLE public.equipment_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truck_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_check_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS equipment_inventory_staff_select ON public.equipment_inventory;
CREATE POLICY equipment_inventory_staff_select ON public.equipment_inventory
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid()));

DROP POLICY IF EXISTS truck_equipment_staff_all ON public.truck_equipment;
CREATE POLICY truck_equipment_staff_all ON public.truck_equipment
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid()));

DROP POLICY IF EXISTS equipment_checks_staff_all ON public.equipment_checks;
CREATE POLICY equipment_checks_staff_all ON public.equipment_checks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid()));

DROP POLICY IF EXISTS equipment_check_lines_staff_all ON public.equipment_check_lines;
CREATE POLICY equipment_check_lines_staff_all ON public.equipment_check_lines
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid()));

DROP POLICY IF EXISTS equipment_incidents_staff_all ON public.equipment_incidents;
CREATE POLICY equipment_incidents_staff_all ON public.equipment_incidents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid()));

DROP POLICY IF EXISTS webhook_idempotency_staff_select ON public.webhook_idempotency_keys;
CREATE POLICY webhook_idempotency_staff_select ON public.webhook_idempotency_keys
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users pu WHERE pu.user_id = auth.uid()));
