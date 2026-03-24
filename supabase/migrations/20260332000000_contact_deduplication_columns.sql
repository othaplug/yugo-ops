-- Contact deduplication: HubSpot + Square linking columns for partners and clients.
-- Partners are stored in organizations; clients are stored in contacts.

-- ── organizations (partners) ──────────────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS hubspot_contact_id TEXT;

CREATE INDEX IF NOT EXISTS idx_organizations_hubspot_contact
  ON organizations(hubspot_contact_id)
  WHERE hubspot_contact_id IS NOT NULL;

-- Unique constraint on email (dedup guard — skip if already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'organizations'
      AND constraint_name = 'organizations_email_unique'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_email_unique UNIQUE (email);
  END IF;
END $$;

-- ── contacts (quote clients) ──────────────────────────────────────────────────
-- hubspot_contact_id TEXT UNIQUE and email TEXT UNIQUE already exist on this table.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS square_customer_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS square_card_id TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_square_customer
  ON contacts(square_customer_id)
  WHERE square_customer_id IS NOT NULL;
