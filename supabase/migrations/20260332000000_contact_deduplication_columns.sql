-- Contact deduplication: HubSpot + Square linking columns for partners and clients.
-- Partners are stored in organizations; clients are stored in contacts.

-- ── organizations (partners) ──────────────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS hubspot_contact_id TEXT;

CREATE INDEX IF NOT EXISTS idx_organizations_hubspot_contact
  ON organizations(hubspot_contact_id)
  WHERE hubspot_contact_id IS NOT NULL;

-- Deduplicate organizations by email.
-- Auto-discovers every FK that references organizations.id via information_schema,
-- re-points loser rows to the keeper, then deletes the losers.
DO $$
DECLARE
  r      RECORD;
  fk     RECORD;
  sql    TEXT;
BEGIN
  -- Build a temp mapping: loser_id -> keeper_id for every duplicate email
  CREATE TEMP TABLE _org_dedup AS
  SELECT
    id AS loser_id,
    first_value(id) OVER (PARTITION BY email ORDER BY id DESC) AS keeper_id
  FROM organizations
  WHERE email IS NOT NULL
    AND email IN (
      SELECT email FROM organizations WHERE email IS NOT NULL GROUP BY email HAVING count(*) > 1
    );

  -- Keep only the loser rows (remove the keeper from the mapping)
  DELETE FROM _org_dedup WHERE loser_id = keeper_id;

  -- Skip entirely if no duplicates exist
  IF NOT EXISTS (SELECT 1 FROM _org_dedup) THEN
    DROP TABLE _org_dedup;
    RETURN;
  END IF;

  -- Auto-discover every table+column that has a FK pointing to organizations.id
  FOR fk IN
    SELECT DISTINCT
      kcu.table_name  AS tbl,
      kcu.column_name AS col
    FROM information_schema.table_constraints        tc
    JOIN information_schema.key_column_usage         kcu ON kcu.constraint_name  = tc.constraint_name
                                                        AND kcu.table_schema     = tc.table_schema
    JOIN information_schema.referential_constraints  rc  ON rc.constraint_name   = tc.constraint_name
                                                        AND rc.constraint_schema = tc.table_schema
    JOIN information_schema.key_column_usage         ccu ON ccu.constraint_name  = rc.unique_constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema    = 'public'
      AND ccu.table_name     = 'organizations'
      AND ccu.column_name    = 'id'
  LOOP
    FOR r IN SELECT loser_id, keeper_id FROM _org_dedup LOOP
      BEGIN
        sql := format(
          'UPDATE public.%I SET %I = $1 WHERE %I = $2',
          fk.tbl, fk.col, fk.col
        );
        EXECUTE sql USING r.keeper_id, r.loser_id;
      EXCEPTION WHEN unique_violation THEN
        -- Keeper already owns a row satisfying the unique constraint;
        -- delete the loser's conflicting rows instead of re-pointing them.
        sql := format(
          'DELETE FROM public.%I WHERE %I = $1',
          fk.tbl, fk.col
        );
        EXECUTE sql USING r.loser_id;
      END;
    END LOOP;
  END LOOP;

  -- Now safe to delete the (now-orphaned) loser org rows
  DELETE FROM organizations WHERE id IN (SELECT loser_id FROM _org_dedup);

  DROP TABLE _org_dedup;
END $$;

-- Unique constraint on email (skip if already present)
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
