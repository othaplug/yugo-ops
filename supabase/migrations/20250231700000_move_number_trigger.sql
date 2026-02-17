-- Ensure move_number is set on insert (same as move_code) for NOT NULL constraint
CREATE OR REPLACE FUNCTION set_move_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.move_code IS NULL OR NEW.move_code = '' THEN
    NEW.move_code := 'MV' || LPAD(nextval('move_code_seq')::text, 4, '0');
  END IF;
  IF NEW.move_number IS NULL OR NEW.move_number = '' THEN
    NEW.move_number := NEW.move_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
