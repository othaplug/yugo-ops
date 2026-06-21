-- Building profile redesign, phase 1: building-type-aware, typed access model.
--
-- Adds an `access_archetype` (house / walk_up / elevator / two_stage) plus the
-- type-specific access dimensions that drive a precise time/scheduling model.
-- Every legacy column is kept; new columns are nullable and CHECK-guarded
-- (NULL always passes), so existing rows and old write paths keep working.
-- Pricing is unchanged: legacy rows keep their stored
-- estimated_extra_minutes_per_trip; the derive engine only computes for rows
-- that carry the new typed fields.

-- ── Archetype ───────────────────────────────────────────────────────────────
ALTER TABLE public.building_profiles
  ADD COLUMN IF NOT EXISTS access_archetype TEXT
    CHECK (access_archetype IN ('house', 'walk_up', 'elevator', 'two_stage'));

-- ── House / ground access ───────────────────────────────────────────────────
ALTER TABLE public.building_profiles
  ADD COLUMN IF NOT EXISTS entrance_steps_band TEXT
    CHECK (entrance_steps_band IN ('none', 'few', 'porch', 'many')),
  ADD COLUMN IF NOT EXISTS interior_levels INTEGER,
  ADD COLUMN IF NOT EXISTS staircase_type TEXT
    CHECK (staircase_type IN ('open', 'narrow', 'tight_turn', 'spiral')),
  ADD COLUMN IF NOT EXISTS truck_spot TEXT
    CHECK (truck_spot IN ('driveway', 'street', 'far', 'laneway'));

-- ── Walk-up ─────────────────────────────────────────────────────────────────
ALTER TABLE public.building_profiles
  ADD COLUMN IF NOT EXISTS unit_floor INTEGER,
  ADD COLUMN IF NOT EXISTS stair_flights INTEGER,
  ADD COLUMN IF NOT EXISTS stair_type TEXT
    CHECK (stair_type IN ('straight', 'switchback', 'spiral', 'exterior')),
  ADD COLUMN IF NOT EXISTS stair_width_band TEXT
    CHECK (stair_width_band IN ('roomy', 'standard', 'tight'));

-- ── Elevator / two-stage ────────────────────────────────────────────────────
ALTER TABLE public.building_profiles
  ADD COLUMN IF NOT EXISTS elevator_type TEXT
    CHECK (elevator_type IN ('freight', 'passenger', 'both', 'none')),
  ADD COLUMN IF NOT EXISTS elevator_window_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS one_move_per_day BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS coi_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS coi_deposit NUMERIC,
  ADD COLUMN IF NOT EXISTS carry_band TEXT
    CHECK (carry_band IN ('short', 'medium', 'long', 'very_long')),
  ADD COLUMN IF NOT EXISTS two_stage_transfer BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lobby_walk_band TEXT
    CHECK (lobby_walk_band IN ('short', 'medium', 'long'));

-- ── Constrain building_type to a known set (canonical + legacy) ──────────────
-- Legacy values (residential, condo_tower, low_rise, townhouse_complex) stay
-- allowed so existing rows and the current admin select don't break; a later
-- phase migrates writers to the canonical set and tightens this.
ALTER TABLE public.building_profiles
  DROP CONSTRAINT IF EXISTS building_profiles_building_type_check;
ALTER TABLE public.building_profiles
  ADD CONSTRAINT building_profiles_building_type_check CHECK (
    building_type IS NULL OR building_type IN (
      'detached_house', 'semi_detached', 'townhouse', 'walk_up',
      'mid_rise', 'high_rise', 'mixed_use', 'loft_heritage', 'commercial', 'other',
      'residential', 'condo_tower', 'low_rise', 'townhouse_complex'
    )
  );

CREATE INDEX IF NOT EXISTS idx_building_profiles_archetype
  ON public.building_profiles (access_archetype);

-- ── Backfill access_archetype from the reliable elevator-topology signal ─────
UPDATE public.building_profiles SET access_archetype = CASE
  WHEN elevator_system = 'stairs_only' THEN 'walk_up'
  WHEN elevator_system IN ('split_transfer', 'multi_transfer')
       OR has_commercial_tenants = TRUE
       OR building_type = 'mixed_use' THEN 'two_stage'
  WHEN elevator_system IN ('standard', 'no_freight') THEN 'elevator'
  ELSE NULL
END
WHERE access_archetype IS NULL;

-- Backfill elevator_type and two_stage_transfer from existing topology.
UPDATE public.building_profiles SET elevator_type = CASE
  WHEN elevator_system = 'stairs_only' THEN 'none'
  WHEN elevator_system = 'no_freight' THEN 'passenger'
  WHEN freight_elevator = TRUE THEN 'freight'
  ELSE 'both'
END
WHERE elevator_type IS NULL AND elevator_system IS NOT NULL;

UPDATE public.building_profiles SET two_stage_transfer = TRUE
WHERE elevator_system IN ('split_transfer', 'multi_transfer')
  AND two_stage_transfer IS NOT TRUE;
