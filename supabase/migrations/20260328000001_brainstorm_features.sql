-- ═══════════════════════════════════════════════════════════════════════
-- Brainstorm Features: Billing, Checklists, Timeline, Routing, Crew, etc.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────
-- 1. PARTNER BILLING (billing_anchor_day, billing_email)
-- ─────────────────────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS billing_anchor_day INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- partner_statements table
CREATE TABLE IF NOT EXISTS partner_statements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id        UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  statement_number  TEXT NOT NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  deliveries        JSONB DEFAULT '[]',
  delivery_count    INTEGER DEFAULT 0,
  subtotal          NUMERIC DEFAULT 0,
  hst               NUMERIC DEFAULT 0,
  total             NUMERIC DEFAULT 0,
  due_date          DATE NOT NULL,
  payment_terms     TEXT NOT NULL,
  status            TEXT DEFAULT 'draft' CHECK (status IN (
                      'draft', 'sent', 'viewed', 'paid', 'partial', 'overdue'
                    )),
  paid_amount       NUMERIC DEFAULT 0,
  paid_at           TIMESTAMPTZ,
  square_invoice_id TEXT,
  pdf_url           TEXT,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_statements_partner  ON partner_statements (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_statements_status   ON partner_statements (status, due_date);
CREATE INDEX IF NOT EXISTS idx_partner_statements_due_date ON partner_statements (due_date);

ALTER TABLE partner_statements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_partner_statements" ON partner_statements FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add statement_id to deliveries
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS statement_id UUID REFERENCES partner_statements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_statement_id ON deliveries (statement_id)
  WHERE statement_id IS NOT NULL;

-- ─────────────────────────────────────────────────────
-- 2. PRE-MOVE CHECKLIST
-- ─────────────────────────────────────────────────────
ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS pre_move_checklist JSONB DEFAULT '{}';

-- ─────────────────────────────────────────────────────
-- 3. LIVE MOVE TIMELINE (stored checkpoints)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS move_timeline_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id     UUID REFERENCES moves(id) ON DELETE CASCADE NOT NULL,
  event_type  TEXT NOT NULL,
  label       TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT 'ClockClockwise',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_move_timeline_move_id ON move_timeline_events (move_id, occurred_at ASC);

ALTER TABLE move_timeline_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_move_timeline_events" ON move_timeline_events FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────
-- 4. WEATHER AWARENESS
-- ─────────────────────────────────────────────────────
ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS weather_alert TEXT,
  ADD COLUMN IF NOT EXISTS weather_checked_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────
-- 5. QUOTE RE-ENGAGEMENT
-- ─────────────────────────────────────────────────────
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS reengagement_sent TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reengagement_converted BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────
-- 6. CLIENT PHOTO ROOM CAPTURE
-- ─────────────────────────────────────────────────────
ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS client_room_photos JSONB DEFAULT '[]';

-- ─────────────────────────────────────────────────────
-- 7. CREW BADGES + TIP TRACKING ON CREW PROFILES
-- ─────────────────────────────────────────────────────
ALTER TABLE crew_profiles
  ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS consecutive_5stars INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piano_jobs INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS piano_damage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS art_jobs INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS art_damage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tips_earned NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_tip_per_job NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS highest_tip NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_tips JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS monthly_jobs JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS monthly_ratings JSONB DEFAULT '{}';

-- ─────────────────────────────────────────────────────
-- 8. DELIVERY SCORES
-- ─────────────────────────────────────────────────────
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS delivery_score INTEGER,
  ADD COLUMN IF NOT EXISTS score_arrived_late BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS score_damage_reported BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS score_end_customer_rating INTEGER,
  ADD COLUMN IF NOT EXISTS score_scope_change BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────
-- 9. WIDGET LEADS (already exists, ensure columns present)
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS widget_leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_size    TEXT,
  from_postal  TEXT,
  to_postal    TEXT,
  month        TEXT,
  low_estimate NUMERIC,
  high_estimate NUMERIC,
  ip_address   TEXT,
  user_agent   TEXT,
  converted    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE widget_leads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_widget_leads" ON widget_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────
-- 10. SMART ROUTING LOG
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routing_suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL,
  suggestion   JSONB NOT NULL,
  savings_km   NUMERIC,
  savings_min  NUMERIC,
  applied      BOOLEAN DEFAULT FALSE,
  dismissed    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE routing_suggestions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "service_role_routing_suggestions" ON routing_suggestions FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────
-- 11. PLATFORM CONFIG DEFAULTS
-- ─────────────────────────────────────────────────────
INSERT INTO platform_config (key, value) VALUES
  ('quote_conversion_rate', '0.35'),
  ('daily_brief_enabled', 'true'),
  ('weather_alerts_enabled', 'true'),
  ('routing_suggestions_enabled', 'true'),
  ('crew_leaderboard_enabled', 'true'),
  ('partner_self_reschedule_enabled', 'true'),
  ('quote_reengagement_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
