-- Ship 1 of the Address & Access redesign: capture a type-aware Access Profile
-- per FROM/TO address on quotes and moves. JSONB holds the captured typed
-- dimensions (property type + floors/flights/elevator/carry/etc.) — the same
-- shape the building model's deriveAccessModel already understands.
--
-- Capture + persist only. No pricing reads these columns yet; the richer model
-- stays behind a flag until Ship 2 wires it into the engine.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS from_access_profile JSONB,
  ADD COLUMN IF NOT EXISTS to_access_profile JSONB;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS from_access_profile JSONB,
  ADD COLUMN IF NOT EXISTS to_access_profile JSONB;

COMMENT ON COLUMN public.quotes.from_access_profile IS
  'Type-aware access capture for the pickup address (property_type + typed dimensions). Fed to deriveAccessModel. Ship 1: capture only.';
COMMENT ON COLUMN public.quotes.to_access_profile IS
  'Type-aware access capture for the destination address. Ship 1: capture only.';
