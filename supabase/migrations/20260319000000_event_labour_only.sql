-- ════════════════════════════════════════════════
-- EVENT + LABOUR ONLY SERVICE TYPES
-- ════════════════════════════════════════════════

-- 1. Add event fields to moves table
ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS event_group_id   UUID,
  ADD COLUMN IF NOT EXISTS event_phase      TEXT CHECK (event_phase IN ('delivery', 'setup', 'return', 'single_day')),
  ADD COLUMN IF NOT EXISTS event_name       TEXT,
  ADD COLUMN IF NOT EXISTS venue_address    TEXT,
  ADD COLUMN IF NOT EXISTS setup_required   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS setup_instructions TEXT;

CREATE INDEX IF NOT EXISTS idx_moves_event_group_id ON moves(event_group_id);

-- 2. Extend quotes service_type CHECK constraint
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_service_type_check;
ALTER TABLE quotes
  ADD CONSTRAINT quotes_service_type_check
  CHECK (service_type IN (
    'local_move','long_distance','office_move','single_item',
    'white_glove','specialty','b2b_delivery','event','labour_only'
  ));

-- 3. Platform config defaults for event and labour-only pricing
INSERT INTO platform_config (key, value) VALUES
  ('event_return_discount',    '0.65'),
  ('event_setup_fee_1hr',      '150'),
  ('event_setup_fee_2hr',      '275'),
  ('event_setup_fee_3hr',      '400'),
  ('event_setup_fee_halfday',  '600'),
  ('labour_only_rate',         '85'),
  ('labour_only_truck_fee',    '150'),
  ('labour_only_visit2_discount', '0.85')
ON CONFLICT (key) DO NOTHING;
