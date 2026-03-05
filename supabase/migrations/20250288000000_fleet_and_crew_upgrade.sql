-- ══════════════════════════════════════════════════
-- Fleet Vehicles Upgrade + Crew Members with Rates
-- ══════════════════════════════════════════════════

-- Fleet vehicles (create if not exists, upgrade if exists)
CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('sprinter', '16ft', '20ft', '24ft', '26ft')),
  license_plate TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  capacity_cuft INTEGER,
  capacity_lbs INTEGER,
  current_mileage INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  default_team_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicle maintenance log
CREATE TABLE IF NOT EXISTS public.vehicle_maintenance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  maintenance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('oil_change', 'tire', 'repair', 'inspection', 'other')),
  cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle ON public.vehicle_maintenance_log(vehicle_id);

-- Vehicle type defaults
INSERT INTO public.fleet_vehicles (vehicle_type, license_plate, display_name, capacity_cuft, capacity_lbs, status)
SELECT 'sprinter', 'SPR786', 'Extended Sprinter Van', 370, 3500, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.fleet_vehicles WHERE license_plate = 'SPR786');

-- Add hourly_rate and specialties to staff_roster if not exists
ALTER TABLE public.staff_roster ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 25.00;
ALTER TABLE public.staff_roster ADD COLUMN IF NOT EXISTS specialties TEXT[];
ALTER TABLE public.staff_roster ADD COLUMN IF NOT EXISTS hire_date DATE;
