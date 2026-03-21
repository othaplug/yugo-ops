-- ════════════════════════════════════════════════
-- SPLIT SPECIALTY AND EVENT SERVICE TYPES
-- Removes the old combined "specialty_event" value.
-- Specialty and Event are now two distinct service types.
-- ════════════════════════════════════════════════

-- 1. Migrate any legacy 'specialty_event' rows in moves table
UPDATE moves
  SET service_type = 'specialty'
  WHERE service_type = 'specialty_event';

UPDATE moves
  SET move_type = 'specialty'
  WHERE move_type = 'specialty_event';

-- 2. Migrate any legacy 'specialty_event' rows in quotes table
UPDATE quotes
  SET service_type = 'specialty'
  WHERE service_type = 'specialty_event';

-- 3. Ensure quotes table constraint is up to date (event and specialty are separate)
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_service_type_check;
ALTER TABLE quotes
  ADD CONSTRAINT quotes_service_type_check
  CHECK (service_type IN (
    'local_move', 'long_distance', 'office_move', 'single_item',
    'white_glove', 'specialty', 'event', 'b2b_delivery', 'labour_only'
  ));

-- 4. Add specialty columns for the new item-focused form
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS specialty_item_description TEXT,
  ADD COLUMN IF NOT EXISTS specialty_type             TEXT,
  ADD COLUMN IF NOT EXISTS specialty_weight_class     TEXT,
  ADD COLUMN IF NOT EXISTS specialty_requirements     TEXT[];

-- 5. Add specialty columns to moves table
ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS specialty_type             TEXT,
  ADD COLUMN IF NOT EXISTS specialty_item_description TEXT,
  ADD COLUMN IF NOT EXISTS specialty_weight_class     TEXT,
  ADD COLUMN IF NOT EXISTS specialty_requirements     TEXT[];
