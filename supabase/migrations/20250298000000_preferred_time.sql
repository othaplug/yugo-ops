-- Add preferred_time column to moves, deliveries, and quotes tables
ALTER TABLE moves ADD COLUMN IF NOT EXISTS preferred_time text;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS preferred_time text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS preferred_time text;
