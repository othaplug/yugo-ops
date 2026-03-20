-- ============================================================
-- Partner Onboarding + Health + SMS Log + Inventory (Walkthrough)
-- ============================================================

-- PART 1: Partner onboarding fields on organizations table
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_title TEXT,
  ADD COLUMN IF NOT EXISTS how_found TEXT,
  ADD COLUMN IF NOT EXISTS referral_source TEXT,
  ADD COLUMN IF NOT EXISTS hubspot_deal_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_types TEXT[],
  ADD COLUMN IF NOT EXISTS delivery_frequency TEXT,
  ADD COLUMN IF NOT EXISTS typical_items TEXT,
  ADD COLUMN IF NOT EXISTS special_requirements TEXT,
  ADD COLUMN IF NOT EXISTS preferred_windows TEXT,
  ADD COLUMN IF NOT EXISTS pickup_locations TEXT[],
  ADD COLUMN IF NOT EXISTS billing_method TEXT DEFAULT 'per_delivery',
  ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'net_30',
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS insurance_cert_url TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_delivery_at TIMESTAMPTZ;

-- Onboarding status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_onboarding_status_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_onboarding_status_check
      CHECK (onboarding_status IN ('draft', 'active', 'paused', 'churned'));
  END IF;
END$$;

-- PART 2: Walkthrough fields on quotes table
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS walkthrough_based BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS walkthrough_date DATE,
  ADD COLUMN IF NOT EXISTS walkthrough_notes TEXT,
  ADD COLUMN IF NOT EXISTS walkthrough_special_items TEXT;

-- PART 3: SMS log table
CREATE TABLE IF NOT EXISTS sms_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  message_body TEXT NOT NULL,
  message_type TEXT NOT NULL,
  related_id UUID,
  related_type TEXT,
  twilio_sid TEXT,
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_log_related ON sms_log(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_sent_at ON sms_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_log_type ON sms_log(message_type);

-- Platform config defaults for sms_enabled
INSERT INTO platform_config (key, value)
  VALUES ('sms_enabled', 'true')
  ON CONFLICT (key) DO NOTHING;

-- Index on last_delivery_at for health queries
CREATE INDEX IF NOT EXISTS idx_organizations_last_delivery_at
  ON organizations(last_delivery_at DESC NULLS LAST);
