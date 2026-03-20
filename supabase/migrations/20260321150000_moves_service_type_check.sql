-- CHECK on moves.service_type — aligns with quotes.service_type allowed values.
-- Includes legacy b2b_oneoff for older rows.

UPDATE moves
SET service_type = 'local_move'
WHERE service_type IS NOT NULL
  AND service_type NOT IN (
    'local_move',
    'long_distance',
    'office_move',
    'single_item',
    'white_glove',
    'specialty',
    'event',
    'b2b_delivery',
    'labour_only',
    'b2b_oneoff'
  );

ALTER TABLE moves DROP CONSTRAINT IF EXISTS moves_service_type_check;
ALTER TABLE moves
  ADD CONSTRAINT moves_service_type_check
  CHECK (
    service_type IS NULL
    OR service_type IN (
      'local_move',
      'long_distance',
      'office_move',
      'single_item',
      'white_glove',
      'specialty',
      'event',
      'b2b_delivery',
      'labour_only',
      'b2b_oneoff'
    )
  );
