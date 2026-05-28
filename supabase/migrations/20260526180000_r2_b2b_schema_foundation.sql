-- Release 2 — B2B schema foundation
--
-- All additions are additive, defaultable, and idempotent. No backfills
-- required for existing rows; everything new is nullable or has a safe
-- default. Existing residential/B2C/PM flows are untouched.
--
-- Companion to the plan in /Users/kog/.claude/plans (sessions 2025-05-26):
-- closes confirmed gaps #3 #4 #5 #14 #15 plus partial coverage of #1 #9.
--
-- Sections:
--   1. quotes: declared_value, deliver_to_*, override_reason_code,
--      inbound_shipment_id
--   2. quotes + moves: white_glove_swap allowed in service_type CHECK
--   3. job_stops: status, status_updated_at (per-leg state machine)
--   4. item_packages: structured per-package dimensions alongside the
--      existing unstructured item_dimensions TEXT
--   5. quote_expiry_policy: per-service-type quote validity (replacing
--      the single global default of 7 days)


-- ─────────────────────────────────────────────────────────────────────
-- 1. quotes: new columns
-- ─────────────────────────────────────────────────────────────────────

-- Declared value of the goods being moved/delivered. Already exists on
-- moves; mirroring up to quotes so it's captured at quote time (matters
-- for wholesale / luxury B2B where the operator must know the cargo
-- value before pricing).
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS declared_value NUMERIC;
COMMENT ON COLUMN quotes.declared_value IS
  'Declared cargo value (CAD). Required for white_glove_swap and quotes >$5K cargo.';

-- Bill-to vs deliver-to separation. The current `contact_id` (via the
-- contacts table) represents the billing party. The deliver_to_* fields
-- represent the consignee/end recipient — e.g. for B2B drop-ship where
-- the wholesaler in Victoria is the bill-to and the customer in Toronto
-- is the deliver-to. Left null when the same as bill-to.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deliver_to_name TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deliver_to_email TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deliver_to_phone TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS deliver_to_notes TEXT;
COMMENT ON COLUMN quotes.deliver_to_name IS
  'Consignee name when different from the billing contact (B2B drop-ship).';

-- Structured override-reason code. The existing `override_reason` text
-- column stays for free-text justification; this adds a controlled
-- taxonomy that the pricing-intelligence dashboard (R5) regresses
-- benchmarks against. Enum is enforced in the app layer rather than the
-- DB so coordinators can add new codes without a migration.
--
-- Recognised codes (app-side validation):
--   competitive_match     — matching a competitor quote (most common)
--   partner_acquisition   — discount to win a new partner account
--   multi_job_discount    — second+ job from same client/partner
--   scope_overstated      — engine over-quoted scope, reducing to real
--   goodwill              — service recovery / damaged-job credit
--   other                 — falls back to free-text override_reason
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS override_reason_code TEXT;
COMMENT ON COLUMN quotes.override_reason_code IS
  'Controlled-taxonomy override reason. Enum enforced in app layer. Free-text justification still lives in override_reason.';

-- Link to an inbound_shipments row when the job scope is "receive at
-- warehouse + deliver." Lets the quote builder and Track page surface
-- inbound milestones (carrier ETA, inspection status, storage state)
-- alongside the quote itself. Null for direct-pickup jobs.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS inbound_shipment_id UUID
  REFERENCES inbound_shipments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS quotes_inbound_shipment_id_idx
  ON quotes(inbound_shipment_id) WHERE inbound_shipment_id IS NOT NULL;
COMMENT ON COLUMN quotes.inbound_shipment_id IS
  'When set, this quote is for a receive-and-deliver job whose inbound crates are tracked separately.';


-- ─────────────────────────────────────────────────────────────────────
-- 2. service_type CHECK: allow white_glove_swap
-- ─────────────────────────────────────────────────────────────────────
-- New service_type for jobs where Yugo delivers a new item and recovers
-- the original (the Fritz Hansen PK65 pattern). Distinct from
-- white_glove (no recovery leg) and b2b_delivery (no swap pair).

ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_service_type_check;
ALTER TABLE quotes
  ADD CONSTRAINT quotes_service_type_check
  CHECK (service_type IN (
    'local_move', 'long_distance', 'office_move', 'single_item',
    'white_glove', 'specialty', 'event', 'b2b_delivery', 'labour_only',
    'bin_rental',
    'white_glove_swap'
  ));

ALTER TABLE moves DROP CONSTRAINT IF EXISTS moves_service_type_check;
ALTER TABLE moves
  ADD CONSTRAINT moves_service_type_check
  CHECK (
    service_type IS NULL
    OR service_type IN (
      'local_move', 'long_distance', 'office_move', 'single_item',
      'white_glove', 'specialty', 'event', 'b2b_delivery', 'labour_only',
      'b2b_oneoff', 'bin_rental',
      'white_glove_swap'
    )
  );


-- ─────────────────────────────────────────────────────────────────────
-- 3. job_stops: per-leg status (already has `notes`)
-- ─────────────────────────────────────────────────────────────────────
-- Stops carry an address + sort_order today but no state. For multi-leg
-- B2B jobs the operator needs per-leg progress visibility (e.g.
-- inbound-received but onward-delivery still pending). Default 'pending'
-- so all existing stops are valid without backfill.

ALTER TABLE job_stops ADD COLUMN IF NOT EXISTS status TEXT
  NOT NULL DEFAULT 'pending';
ALTER TABLE job_stops ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;

ALTER TABLE job_stops DROP CONSTRAINT IF EXISTS job_stops_status_check;
ALTER TABLE job_stops
  ADD CONSTRAINT job_stops_status_check
  CHECK (status IN (
    'pending',
    'in_transit',
    'arrived',
    'in_progress',
    'completed',
    'skipped',
    'failed'
  ));

COMMENT ON COLUMN job_stops.status IS
  'Per-leg state. Defaults to pending. Updated by crew app on arrival/completion.';


-- ─────────────────────────────────────────────────────────────────────
-- 4. item_packages: structured per-package dimensions
-- ─────────────────────────────────────────────────────────────────────
-- The existing item_dimensions TEXT on move_inventory / project_inventory
-- captures dimensions as a freeform string ("110×110×10cm, 98kg"). This
-- table lets us record each crate / package separately with structured
-- numeric fields the pricing engine and crew app can actually compute on
-- (e.g. cubic-ft pricing in R5, two-person-carry threshold for crew brief).
--
-- parent_table + parent_id is a polymorphic FK because items live in
-- multiple tables across verticals. Uniqueness on (parent, index) lets
-- the app upsert per-package without delete-then-insert.

CREATE TABLE IF NOT EXISTS item_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_table    TEXT NOT NULL
    CHECK (parent_table IN (
      'move_inventory', 'project_inventory', 'delivery_items',
      'inbound_shipment_items', 'quote_items'
    )),
  parent_id       UUID NOT NULL,
  package_index   INT  NOT NULL CHECK (package_index >= 1),
  length_cm       NUMERIC(8,2),
  width_cm        NUMERIC(8,2),
  height_cm       NUMERIC(8,2),
  weight_kg       NUMERIC(8,2),
  crate_type      TEXT
    CHECK (crate_type IS NULL OR crate_type IN (
      'wood_crate', 'cardboard', 'palletized', 'shrink_wrapped',
      'blanket_wrapped', 'foam_padded', 'custom'
    )),
  fragile         BOOLEAN NOT NULL DEFAULT FALSE,
  hazmat          BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_table, parent_id, package_index)
);

CREATE INDEX IF NOT EXISTS item_packages_parent_idx
  ON item_packages (parent_table, parent_id, package_index);

ALTER TABLE item_packages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'item_packages'
      AND policyname = 'Service role full access to item_packages'
  ) THEN
    CREATE POLICY "Service role full access to item_packages"
      ON item_packages FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_item_packages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS item_packages_updated_at ON item_packages;
CREATE TRIGGER item_packages_updated_at
  BEFORE UPDATE ON item_packages
  FOR EACH ROW EXECUTE FUNCTION set_item_packages_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- 5. quote_expiry_policy: per-service-type quote validity
-- ─────────────────────────────────────────────────────────────────────
-- The global platform_config.quote_expiry_days = '7' is wrong for
-- wholesale B2B (orders ship 6-8 weeks from Europe) and too long for
-- single-item delivery (customer expects same-week resolution).
-- This table lets each service type carry its own expiry; the app
-- reads from here first, falls back to platform_config.

CREATE TABLE IF NOT EXISTS quote_expiry_policy (
  service_type   TEXT PRIMARY KEY,
  days           INT NOT NULL CHECK (days > 0 AND days <= 365),
  reason         TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE quote_expiry_policy ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'quote_expiry_policy'
      AND policyname = 'Service role full access to quote_expiry_policy'
  ) THEN
    CREATE POLICY "Service role full access to quote_expiry_policy"
      ON quote_expiry_policy FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

INSERT INTO quote_expiry_policy(service_type, days, reason) VALUES
  ('local_move',       7,  'Residential booking window — clients book within a week'),
  ('long_distance',    14, 'Long-distance moves need more planning, but rates still shift'),
  ('office_move',      30, 'Office moves coordinate with lease dates'),
  ('single_item',      7,  'Single-item deliveries are short-horizon'),
  ('white_glove',      30, 'White-glove jobs typically book within a month'),
  ('white_glove_swap', 90, 'Wholesale orders ship 6-8 weeks from Europe; quote must hold'),
  ('specialty',        60, 'Specialty jobs need crew + equipment coordination'),
  ('event',            30, 'Event logistics align with event date'),
  ('b2b_delivery',     30, 'B2B partners typically book within a month'),
  ('labour_only',      14, 'Labour-only jobs are short-horizon'),
  ('bin_rental',       14, 'Bin rentals are short-horizon')
ON CONFLICT (service_type) DO NOTHING;
