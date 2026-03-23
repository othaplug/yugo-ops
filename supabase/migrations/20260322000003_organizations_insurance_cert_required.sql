-- Add insurance_cert_required flag to organizations (missed in partner onboarding migration)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS insurance_cert_required BOOLEAN DEFAULT FALSE;
