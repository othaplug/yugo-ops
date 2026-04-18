-- Building intelligence: profiles, proximity search, institutional knowledge for quoting.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

INSERT INTO public.notification_events (event_slug, event_name, description, category, display_order) VALUES
('building_profile_pending', 'Building profile pending review', 'Crew submitted a building access report that needs coordinator verification', 'moves', 14)
ON CONFLICT (event_slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.building_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  address TEXT NOT NULL,
  postal_code TEXT,
  building_name TEXT,
  management_company TEXT,

  latitude NUMERIC,
  longitude NUMERIC,

  building_type TEXT NOT NULL DEFAULT 'residential',

  elevator_system TEXT NOT NULL DEFAULT 'standard',
  freight_elevator BOOLEAN NOT NULL DEFAULT FALSE,
  freight_elevator_location TEXT,
  residential_elevator_location TEXT,
  transfer_floors TEXT[],
  total_elevator_transfers INTEGER NOT NULL DEFAULT 0,

  estimated_extra_minutes_per_trip INTEGER NOT NULL DEFAULT 0,
  complexity_rating INTEGER NOT NULL DEFAULT 1,

  loading_dock BOOLEAN NOT NULL DEFAULT FALSE,
  loading_dock_location TEXT,
  loading_dock_restrictions TEXT,
  loading_dock_booking_required BOOLEAN NOT NULL DEFAULT FALSE,

  has_commercial_tenants BOOLEAN NOT NULL DEFAULT FALSE,
  commercial_tenants TEXT[],

  move_hours TEXT,
  elevator_booking_required BOOLEAN NOT NULL DEFAULT TRUE,
  elevator_max_hours INTEGER,
  elevator_shared BOOLEAN NOT NULL DEFAULT FALSE,

  hallway_width TEXT,
  doorway_dimensions TEXT,
  max_item_length TEXT,
  freight_elevator_dimensions TEXT,

  parking_type TEXT,
  parking_notes TEXT,

  total_floors INTEGER,
  total_units INTEGER,
  residential_floors TEXT,
  commercial_floors TEXT,

  crew_notes TEXT,
  coordinator_notes TEXT,

  photo_urls TEXT[],

  source TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,

  times_moved_here INTEGER NOT NULL DEFAULT 0,
  last_move_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_building_profiles_address_trgm
  ON public.building_profiles USING gin (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_building_profiles_postal
  ON public.building_profiles (postal_code);

CREATE INDEX IF NOT EXISTS idx_building_profiles_coords
  ON public.building_profiles (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_building_profiles_complexity
  ON public.building_profiles (complexity_rating DESC);

CREATE INDEX IF NOT EXISTS idx_building_profiles_verified
  ON public.building_profiles (verified);

DROP TRIGGER IF EXISTS set_building_profiles_updated_at ON public.building_profiles;
CREATE TRIGGER set_building_profiles_updated_at
  BEFORE UPDATE ON public.building_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.building_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.find_nearby_building(
  search_lat NUMERIC,
  search_lng NUMERIC,
  radius_meters INTEGER DEFAULT 50
)
RETURNS SETOF public.building_profiles
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.building_profiles
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND (
      6371000 * acos(
        LEAST(1::numeric, GREATEST(-1::numeric,
          cos(radians(search_lat::double precision)) * cos(radians(latitude::double precision))
          * cos(radians(longitude::double precision) - radians(search_lng::double precision))
          + sin(radians(search_lat::double precision)) * sin(radians(latitude::double precision))
        ))
      )
    ) < radius_meters
  ORDER BY (
    6371000 * acos(
      LEAST(1::numeric, GREATEST(-1::numeric,
        cos(radians(search_lat::double precision)) * cos(radians(latitude::double precision))
        * cos(radians(longitude::double precision) - radians(search_lng::double precision))
        + sin(radians(search_lat::double precision)) * sin(radians(latitude::double precision))
      ))
    )
  )
  LIMIT 1;
$$;

INSERT INTO public.building_profiles
  (address, building_name, building_type, elevator_system,
   total_elevator_transfers, estimated_extra_minutes_per_trip,
   complexity_rating, has_commercial_tenants, commercial_tenants,
   loading_dock, elevator_shared, crew_notes, source, verified)
VALUES
  (
    'PLACEHOLDER mixed-use building with Longo''s',
    'Building with Longo''s',
    'mixed_use',
    'multi_transfer',
    2,
    12,
    5,
    TRUE,
    ARRAY['Longo''s']::TEXT[],
    TRUE,
    TRUE,
    'P-level dock, freight to lobby, transfer to residential tower. About 12 minutes per trip. Budget 3 to 4 extra hours for a 3 bedroom.',
    'crew_report',
    FALSE
  ),
  (
    'PLACEHOLDER courtyard building',
    'Courtyard building',
    'mixed_use',
    'split_transfer',
    1,
    8,
    4,
    TRUE,
    ARRAY[]::TEXT[],
    TRUE,
    TRUE,
    'Courtyard layout with split elevator system. Heavy unload time risk when routing is tight.',
    'crew_report',
    FALSE
  );
