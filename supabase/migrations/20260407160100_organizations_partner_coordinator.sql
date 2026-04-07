-- Optional PM partner coordinator contact (shown in partner portal Account tab).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS partner_coordinator_name TEXT,
  ADD COLUMN IF NOT EXISTS partner_coordinator_email TEXT,
  ADD COLUMN IF NOT EXISTS partner_coordinator_phone TEXT;

COMMENT ON COLUMN public.organizations.partner_coordinator_name IS 'Assigned Yugo coordinator name for partner-facing portal.';
COMMENT ON COLUMN public.organizations.partner_coordinator_email IS 'Coordinator email for partner portal.';
COMMENT ON COLUMN public.organizations.partner_coordinator_phone IS 'Coordinator phone for partner portal.';
