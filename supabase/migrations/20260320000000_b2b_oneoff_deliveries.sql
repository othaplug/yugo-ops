-- ════════════════════════════════════════════════
-- B2B ONE-OFF DELIVERIES (no partner account)
-- ════════════════════════════════════════════════

-- Add business/contact fields for B2B one-offs (partner_id = NULL)
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS business_name   TEXT,
  ADD COLUMN IF NOT EXISTS contact_name    TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone   TEXT,
  ADD COLUMN IF NOT EXISTS contact_email   TEXT;

-- Platform config for B2B one-off base fee
INSERT INTO platform_config (key, value) VALUES
  ('b2b_oneoff_base', '350')
ON CONFLICT (key) DO NOTHING;
