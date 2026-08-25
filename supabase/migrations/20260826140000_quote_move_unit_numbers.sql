-- Per-address unit / suite numbers for residential quotes and moves.
--
-- A move has a pickup (from_address) and a destination (to_address), and either
-- can be a condo/apartment or walk-up with a unit number. The legacy single
-- `unit_number` column (used by PM/partner contexts) cannot represent both ends,
-- so add explicit from_unit / to_unit. Units are stored separately from the
-- street address (units do not geocode) and combined for display via
-- formatAddressWithUnit().

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS from_unit TEXT,
  ADD COLUMN IF NOT EXISTS to_unit TEXT;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS from_unit TEXT,
  ADD COLUMN IF NOT EXISTS to_unit TEXT;
