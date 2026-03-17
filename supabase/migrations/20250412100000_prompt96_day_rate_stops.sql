-- Prompt 96: Day Rate Multi-Stop Flow

-- ── delivery_stops: add status tracking columns ──────────────────────────────
ALTER TABLE delivery_stops ADD COLUMN IF NOT EXISTS stop_status TEXT DEFAULT 'pending'
  CHECK (stop_status IN ('pending','current','arrived','in_progress','completed','skipped'));

ALTER TABLE delivery_stops ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;

ALTER TABLE delivery_stops ADD COLUMN IF NOT EXISTS stop_type TEXT DEFAULT 'delivery'
  CHECK (stop_type IN ('pickup','delivery'));

ALTER TABLE delivery_stops ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE delivery_stops ADD COLUMN IF NOT EXISTS notes TEXT;

-- ── deliveries: track stop completion count ───────────────────────────────────
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS stops_completed INTEGER DEFAULT 0;
