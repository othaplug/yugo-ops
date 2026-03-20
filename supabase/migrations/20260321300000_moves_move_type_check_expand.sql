-- Align moves.move_type CHECK with Create Move API + quote imports.
-- Previously remote DB often only allowed residential/office, breaking specialty/single_item/etc.

UPDATE moves
SET move_type = 'specialty'
WHERE move_type = 'specialty_event';

ALTER TABLE moves DROP CONSTRAINT IF EXISTS moves_move_type_check;

ALTER TABLE moves
  ADD CONSTRAINT moves_move_type_check
  CHECK (
    move_type IS NULL
    OR move_type IN (
      'residential',
      'office',
      'single_item',
      'white_glove',
      'specialty',
      'b2b_oneoff',
      -- Distinct high-level buckets (optional explicit classification)
      'event',
      'labour_only'
    )
  );
