-- ═══════════════════════════════════════════════════════════
-- Intelligence Engine: Learning, Crew, and Scheduling Tables
-- ═══════════════════════════════════════════════════════════

-- ── Calibration Data: raw prediction vs. actuals per completed move ──
CREATE TABLE IF NOT EXISTS calibration_data (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id              UUID REFERENCES moves(id) ON DELETE CASCADE,
  move_size            TEXT,
  service_type         TEXT,
  tier                 TEXT,

  -- Hours
  estimated_hours      NUMERIC,
  actual_hours         NUMERIC,
  hours_variance       NUMERIC GENERATED ALWAYS AS (actual_hours - estimated_hours) STORED,

  -- Crew
  recommended_crew     INTEGER,
  actual_crew          INTEGER,
  crew_variance        INTEGER GENERATED ALWAYS AS (actual_crew - recommended_crew) STORED,

  -- Truck
  recommended_truck    TEXT,
  actual_truck         TEXT,
  truck_match          BOOLEAN GENERATED ALWAYS AS (recommended_truck = actual_truck) STORED,

  -- Inventory score
  quoted_score         NUMERIC,
  actual_score         NUMERIC,
  inventory_variance   NUMERIC GENERATED ALWAYS AS (COALESCE(actual_score, quoted_score) - quoted_score) STORED,

  -- Location
  from_postal          TEXT,
  to_postal            TEXT,
  from_building        TEXT,
  to_building          TEXT,
  distance_km          NUMERIC,

  -- Time
  day_of_week          TEXT,
  month                INTEGER,
  arrival_window       TEXT,
  actual_start_time    TEXT,

  -- Crew assignment
  crew_lead_id         UUID,
  crew_member_ids      UUID[],

  -- Outcomes
  satisfaction_rating  INTEGER,
  damage_reported      BOOLEAN DEFAULT FALSE,

  -- Financials
  revenue              NUMERIC,
  cost                 NUMERIC,
  margin_percent       NUMERIC,

  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calibration_data_move_size    ON calibration_data (move_size, service_type);
CREATE INDEX IF NOT EXISTS idx_calibration_data_created_at   ON calibration_data (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calibration_data_move_id      ON calibration_data (move_id);

-- ── Calibration Suggestions: AI-generated config update proposals ──
CREATE TABLE IF NOT EXISTS calibration_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL,
  move_size       TEXT,
  service_type    TEXT,
  current_value   TEXT,
  suggested_value TEXT,
  confidence      TEXT CHECK (confidence IN ('low', 'medium', 'high')),
  reason          TEXT,
  sample_size     INTEGER,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
  applied_at      TIMESTAMPTZ,
  applied_by      UUID REFERENCES auth.users(id),
  dismissed_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calibration_suggestions_status ON calibration_suggestions (status, created_at DESC);

-- ── Address Intelligence: per-building performance tracking ──
CREATE TABLE IF NOT EXISTS address_intelligence (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address                     TEXT NOT NULL,
  building_name               TEXT,
  postal_code                 TEXT,
  avg_hours_variance          NUMERIC DEFAULT 0,
  avg_loading_time_minutes    NUMERIC,
  avg_unloading_time_minutes  NUMERIC,
  move_count                  INTEGER DEFAULT 0,
  has_loading_dock            BOOLEAN,
  elevator_count              INTEGER,
  move_elevator_available     BOOLEAN,
  parking_difficulty          TEXT CHECK (parking_difficulty IN ('easy', 'moderate', 'difficult', 'very_difficult')),
  building_notes              TEXT,
  last_updated                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address)
);

CREATE INDEX IF NOT EXISTS idx_address_intelligence_postal ON address_intelligence (postal_code);

-- ── Crew Profiles: aggregate performance stats per crew member ──
CREATE TABLE IF NOT EXISTS crew_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT,
  role                  TEXT CHECK (role IN ('lead', 'member')),

  -- Aggregate stats (updated after each completed job)
  total_jobs            INTEGER DEFAULT 0,
  avg_satisfaction      NUMERIC DEFAULT 0,
  avg_hours_vs_estimate NUMERIC DEFAULT 0,
  damage_incidents      INTEGER DEFAULT 0,
  damage_rate           NUMERIC DEFAULT 0,
  on_time_rate          NUMERIC DEFAULT 0,

  -- Specialty scores (0–100)
  score_residential     INTEGER DEFAULT 50,
  score_white_glove     INTEGER DEFAULT 50,
  score_art_handling    INTEGER DEFAULT 50,
  score_piano           INTEGER DEFAULT 50,
  score_heavy_items     INTEGER DEFAULT 50,
  score_events          INTEGER DEFAULT 50,
  score_office          INTEGER DEFAULT 50,
  score_high_value      INTEGER DEFAULT 50,

  -- Capabilities
  max_floor_walkup      INTEGER DEFAULT 4,
  can_drive_26ft        BOOLEAN DEFAULT FALSE,
  can_handle_piano      BOOLEAN DEFAULT FALSE,

  last_updated          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_profiles_user_id ON crew_profiles (user_id);

-- ── Auto-scheduling alternatives: stored when requested slot is full ──
CREATE TABLE IF NOT EXISTS scheduling_alternatives (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id          UUID REFERENCES moves(id) ON DELETE CASCADE,
  alt_date         DATE NOT NULL,
  alt_window       TEXT NOT NULL,
  team_name        TEXT,
  crew_ids         UUID[],
  is_selected      BOOLEAN DEFAULT FALSE,
  selected_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduling_alternatives_move_id ON scheduling_alternatives (move_id);

-- RLS: open to service role (server-side only)
ALTER TABLE calibration_data           ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_suggestions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_intelligence       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_alternatives    ENABLE ROW LEVEL SECURITY;

-- Service role bypass (used by server-side admin client)
CREATE POLICY "service_role_calibration_data"        ON calibration_data        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_calibration_suggestions" ON calibration_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_address_intelligence"    ON address_intelligence    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_crew_profiles"           ON crew_profiles           FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_scheduling_alternatives" ON scheduling_alternatives FOR ALL TO service_role USING (true) WITH CHECK (true);
