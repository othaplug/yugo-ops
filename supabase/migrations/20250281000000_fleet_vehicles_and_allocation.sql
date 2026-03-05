-- ══════════════════════════════════════════════════
-- Fleet Vehicles & Truck Allocation Rules
-- ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  cargo_cubic_ft INTEGER NOT NULL,
  capacity_lbs INTEGER NOT NULL,
  description TEXT,
  license_plate TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.fleet_vehicles (vehicle_type, display_name, cargo_cubic_ft, capacity_lbs, description, display_order)
VALUES
('sprinter', 'Extended High Roof Sprinter', 370, 3500, 'Ideal for studios, 1BR, single items, white glove deliveries', 1),
('16ft', '16ft Box Truck', 850, 5000, 'Perfect for 1-2BR apartments and light 3BR moves', 2),
('20ft', '20ft Box Truck', 1100, 7000, 'Suited for 2-3BR homes with standard furnishings', 3),
('24ft', '24ft Box Truck', 1450, 9500, 'Built for 3-4BR homes and medium commercial moves', 4),
('26ft', '26ft Box Truck', 1700, 10000, 'Full capacity for 4-5BR homes, estate moves, large offices', 5)
ON CONFLICT (vehicle_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.truck_allocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_size TEXT NOT NULL,
  inventory_range TEXT NOT NULL CHECK (inventory_range IN ('no_inventory','light','standard','heavy')),
  primary_vehicle TEXT NOT NULL,
  secondary_vehicle TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(move_size, inventory_range)
);

INSERT INTO public.truck_allocation_rules (move_size, inventory_range, primary_vehicle, secondary_vehicle, notes) VALUES
('studio',      'no_inventory', 'sprinter', NULL, NULL),
('studio',      'light',        'sprinter', NULL, NULL),
('studio',      'standard',     'sprinter', NULL, NULL),
('studio',      'heavy',        '16ft',     NULL, 'Packed studio'),
('1br',         'no_inventory', 'sprinter', NULL, NULL),
('1br',         'light',        'sprinter', NULL, NULL),
('1br',         'standard',     '16ft',     NULL, NULL),
('1br',         'heavy',        '16ft',     NULL, NULL),
('2br',         'no_inventory', '16ft',     NULL, NULL),
('2br',         'light',        '16ft',     NULL, NULL),
('2br',         'standard',     '16ft',     NULL, NULL),
('2br',         'heavy',        '20ft',     NULL, 'Heavy 2BR needs upgrade'),
('3br',         'no_inventory', '20ft',     NULL, NULL),
('3br',         'light',        '16ft',     NULL, NULL),
('3br',         'standard',     '20ft',     NULL, NULL),
('3br',         'heavy',        '24ft',     NULL, 'Heavy 3BR may need 24ft'),
('4br',         'no_inventory', '24ft',     NULL, NULL),
('4br',         'light',        '20ft',     NULL, NULL),
('4br',         'standard',     '24ft',     NULL, NULL),
('4br',         'heavy',        '26ft',     NULL, 'Max single vehicle'),
('5br_plus',    'no_inventory', '26ft',     NULL, NULL),
('5br_plus',    'light',        '24ft',     NULL, NULL),
('5br_plus',    'standard',     '26ft',     NULL, NULL),
('5br_plus',    'heavy',        '26ft',     'sprinter', 'Multi-vehicle estate move'),
('partial',     'no_inventory', 'sprinter', NULL, NULL),
('partial',     'light',        'sprinter', NULL, NULL),
('partial',     'standard',     'sprinter', NULL, NULL),
('partial',     'heavy',        '16ft',     NULL, NULL),
('single_item', 'no_inventory', 'sprinter', NULL, NULL),
('single_item', 'light',        'sprinter', NULL, NULL),
('single_item', 'standard',     'sprinter', NULL, NULL),
('single_item', 'heavy',        'sprinter', NULL, NULL),
('white_glove', 'no_inventory', 'sprinter', NULL, NULL),
('white_glove', 'light',        'sprinter', NULL, NULL),
('white_glove', 'standard',     'sprinter', NULL, NULL),
('white_glove', 'heavy',        '16ft',     NULL, NULL)
ON CONFLICT (move_size, inventory_range) DO NOTHING;

-- Add truck columns to quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS truck_primary TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS truck_secondary TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS truck_override BOOLEAN DEFAULT FALSE;

-- Add truck columns to moves
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS truck_primary TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS truck_secondary TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS truck_override BOOLEAN DEFAULT FALSE;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS truck_notes TEXT;

-- RLS
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truck_allocation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fleet_vehicles" ON public.fleet_vehicles FOR SELECT USING (true);
CREATE POLICY "Admins manage fleet_vehicles" ON public.fleet_vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admins manage truck_allocation_rules" ON public.truck_allocation_rules FOR ALL USING (true) WITH CHECK (true);
