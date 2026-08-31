-- Recipient split for B2B deliveries.
--
-- Before this migration, the B2B delivery form collapsed the receiving
-- client's contact info onto the partner's contact info (contact_name /
-- contact_phone). When both roles shared a phone number, stage-tracking
-- SMS fired twice (once as partner, once as recipient) — see
-- DLV-30405. Splitting them gives the operator a first-class recipient
-- record so partner-facing updates and recipient-facing tracking texts
-- go to the correct number without ever colliding.
--
-- `recipient_mode = 'partner'` is the safe default and preserves the
-- pre-migration behaviour: the partner contact IS the recipient, one
-- SMS fires per stage. `recipient_mode = 'separate'` unlocks the
-- recipient columns and the notifier routes tracking SMS to
-- recipient_phone, business updates to contact_phone.

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS recipient_mode text NOT NULL DEFAULT 'partner',
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS recipient_notes text;

ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_recipient_mode_check;

ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_recipient_mode_check
  CHECK (recipient_mode IN ('partner', 'separate'));

-- Force the schema cache to reload so the new columns are visible to
-- the PostgREST layer immediately, without waiting for the periodic
-- auto-reload.
NOTIFY pgrst, 'reload schema';
