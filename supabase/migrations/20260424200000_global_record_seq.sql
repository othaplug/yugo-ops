-- Global record ID sequence
-- Single shared counter for YG (quotes), MV (moves), DLV (deliveries).
-- One incrementing number across all types; prefix identifies category.

CREATE SEQUENCE IF NOT EXISTS global_record_seq
  INCREMENT BY 1
  NO MAXVALUE
  NO MINVALUE
  CACHE 1;

-- Returns e.g. 'YG-30201', 'MV-30202', 'DLV-30203'
CREATE OR REPLACE FUNCTION generate_record_id(prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('global_record_seq');
  RETURN prefix || '-' || next_val::text;
END;
$$;

-- Align the sequence to start AFTER the highest existing numeric ID across all record types.
-- Ensures no collisions with existing YG-3XXX quotes, MV1234 moves, or DLV-1234 deliveries.
-- Minimum start is 30200 (safely above the existing YG-3XXX quote range).
DO $$
DECLARE
  min_start  BIGINT := 30200;
  max_found  BIGINT := 0;
  curr_max   BIGINT;
BEGIN
  -- Max from quotes (e.g. YG-30173 → 30173, or YG-3173 → 3173)
  BEGIN
    SELECT COALESCE(MAX(
      CAST(REGEXP_REPLACE(quote_id, '[^0-9]', '', 'g') AS BIGINT)
    ), 0)
    INTO curr_max
    FROM quotes
    WHERE quote_id IS NOT NULL
      AND quote_id ~ '^[A-Za-z]+-?[0-9]+$';
    IF curr_max > max_found THEN max_found := curr_max; END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Max from moves (e.g. MV1234 → 1234, MV-30202 → 30202)
  BEGIN
    SELECT COALESCE(MAX(
      CAST(REGEXP_REPLACE(move_code, '[^0-9]', '', 'g') AS BIGINT)
    ), 0)
    INTO curr_max
    FROM moves
    WHERE move_code IS NOT NULL
      AND move_code ~ '^[A-Za-z]+-?[0-9]+$';
    IF curr_max > max_found THEN max_found := curr_max; END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Max from deliveries (e.g. DLV-1234 → 1234)
  BEGIN
    SELECT COALESCE(MAX(
      CAST(REGEXP_REPLACE(delivery_number, '[^0-9]', '', 'g') AS BIGINT)
    ), 0)
    INTO curr_max
    FROM deliveries
    WHERE delivery_number IS NOT NULL
      AND delivery_number ~ '^DLV-[0-9]+$';
    IF curr_max > max_found THEN max_found := curr_max; END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Start sequence after max found, but no lower than min_start
  IF max_found >= min_start THEN
    PERFORM setval('global_record_seq', max_found + 1, false);
  ELSE
    PERFORM setval('global_record_seq', min_start, false);
  END IF;
END $$;

-- Update the move_code trigger to use the global sequence.
-- New moves get MV-30201 style codes; existing MV1234 rows are unchanged.
CREATE OR REPLACE FUNCTION set_move_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.move_code IS NULL OR NEW.move_code = '' THEN
    NEW.move_code := generate_record_id('MV');
    NEW.move_number := NEW.move_code;
  END IF;
  RETURN NEW;
END;
$$;

-- Re-create the trigger (idempotent)
DROP TRIGGER IF EXISTS set_move_code_trigger ON public.moves;
CREATE TRIGGER set_move_code_trigger
  BEFORE INSERT ON public.moves
  FOR EACH ROW EXECUTE FUNCTION set_move_code();

-- Grant RPC access to service role (application uses service role for admin operations)
GRANT EXECUTE ON FUNCTION generate_record_id(TEXT) TO service_role;
