-- Configurable office/HQ location in platform_settings
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS office_lat DOUBLE PRECISION DEFAULT 43.66027;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS office_lng DOUBLE PRECISION DEFAULT -79.35365;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS office_address TEXT DEFAULT '50 Carroll St, Toronto, ON M4M 3G3';
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS office_radius_m INTEGER DEFAULT 200;

-- Tips table: one tip per move
CREATE TABLE IF NOT EXISTS tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID REFERENCES moves(id) UNIQUE,
  crew_id UUID REFERENCES crews(id),
  client_name TEXT,
  crew_name TEXT,
  amount NUMERIC NOT NULL,
  processing_fee NUMERIC,
  net_amount NUMERIC,
  square_payment_id TEXT,
  charged_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tips_move ON tips(move_id);
CREATE INDEX IF NOT EXISTS idx_tips_crew ON tips(crew_id);
CREATE INDEX IF NOT EXISTS idx_tips_charged ON tips(charged_at);

-- Tip tracking columns on moves
ALTER TABLE moves ADD COLUMN IF NOT EXISTS tip_amount NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS tip_charged_at TIMESTAMPTZ;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS tip_prompt_shown_at TIMESTAMPTZ;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS tip_skipped_at TIMESTAMPTZ;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS card_last4 TEXT;
