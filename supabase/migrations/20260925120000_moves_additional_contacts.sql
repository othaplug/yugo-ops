-- Additional contacts on residential moves.
-- A move stores one inline client contact (client_name/email/phone). Ops needs
-- to add extra people (e.g. a spouse) who ALSO receive move-day tracking and
-- pre-move reminders. Stored as a JSONB array (mirrors moves.assigned_members)
-- of { name, phone, email, tracking, reminders }. Fan-out + dedup happens in
-- the app (src/lib/moves/move-recipients.ts).
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS additional_contacts JSONB DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
