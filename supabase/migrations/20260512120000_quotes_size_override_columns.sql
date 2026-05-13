-- Store coordinator's explicit confirmation when overriding auto-detected move size.
-- When the inventory score is significantly below the typical range for the stated size,
-- the quote form requires the coordinator to click "Keep {size} — I've verified this"
-- before they can proceed. That confirmation is stored here for audit trails.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS size_override_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS size_override_reason    TEXT;
