-- Support for bookings that happen outside OPS+ (HubSpot, email, phone, etc.)
-- These columns are optional; existing rows default to FALSE / NULL.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS externally_booked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS booked_via        TEXT,      -- 'ops_plus'|'hubspot'|'email'|'phone'|'in_person'|'other'
  ADD COLUMN IF NOT EXISTS booking_notes     TEXT;

ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS externally_booked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS booked_via        TEXT,
  ADD COLUMN IF NOT EXISTS booking_notes     TEXT;
