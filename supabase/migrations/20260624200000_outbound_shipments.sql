-- Outbound staging shipments — the reverse of inbound_shipments.
--
-- Use case (2026-06-24, Oche): a B2B partner (a furniture brand like Blu
-- Dot's logistics arm) asks Yugo to pick up an item from a residential
-- consignor, bring it to the Yugo warehouse, palletize / crate it, hold
-- it briefly, then hand it off to a 3rd-party freight carrier (FedEx
-- Freight, ABF, etc.) for the long-haul.
--
-- Yugo bills the partner for: pickup + transport + warehouse intake +
-- palletization + hold-days. The actual long-haul is the carrier's job.
--
-- Status lifecycle:
--   draft
--    -> scheduled            (admin booked the pickup, partner notified)
--    -> picked_up            (crew arrived + collected at the residence)
--    -> at_warehouse         (item logged in at receiving)
--    -> palletizing          (warehouse staff started crating / palletizing)
--    -> ready_for_carrier    (pallet built, BOL printed, awaiting carrier appointment)
--    -> handed_off           (carrier collected; PRO + BOL captured)
--    -> completed            (invoice sent + paid by partner)
--   plus -> cancelled at any point with cancellation_reason captured.

CREATE TABLE IF NOT EXISTS public.outbound_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number TEXT UNIQUE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,

  -- ── Partner (the B2B customer paying Yugo) ──
  partner_id UUID,
  partner_name TEXT,
  partner_contact_name TEXT,
  partner_contact_email TEXT,
  partner_contact_phone TEXT,
  business_name TEXT,

  -- ── Consignor (the residential person releasing the item) ──
  consignor_name TEXT,
  consignor_email TEXT,
  consignor_phone TEXT,
  consignor_address TEXT,
  consignor_postal TEXT,
  consignor_access TEXT,
  consignor_notes TEXT,

  -- ── Items being shipped ──
  -- Each entry: { name, dimensions, weight_lb, value, notes, requires_palletization }
  items JSONB DEFAULT '[]'::jsonb,
  total_pieces INT,
  declared_value NUMERIC(12,2),

  -- ── Service requirements ──
  requires_palletization BOOLEAN DEFAULT TRUE,
  requires_crating BOOLEAN DEFAULT FALSE,
  requires_assembly BOOLEAN DEFAULT FALSE,
  service_level TEXT DEFAULT 'standard',
  special_instructions TEXT,

  -- ── Pickup at the consignor ──
  scheduled_pickup_date DATE,
  scheduled_pickup_window TEXT,
  pickup_arrived_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  picked_up_by TEXT,
  pickup_photos JSONB DEFAULT '[]'::jsonb,
  pickup_notes TEXT,
  pickup_condition TEXT CHECK (pickup_condition IS NULL OR pickup_condition IN ('good','damaged','partial_damage')),
  pickup_condition_notes TEXT,

  -- ── Warehouse receiving ──
  received_at_warehouse_at TIMESTAMPTZ,
  received_by TEXT,
  intake_photos JSONB DEFAULT '[]'::jsonb,
  storage_location TEXT,

  -- ── Palletization / crating at warehouse ──
  palletizing_started_at TIMESTAMPTZ,
  palletized_at TIMESTAMPTZ,
  palletized_by TEXT,
  palletized_photos JSONB DEFAULT '[]'::jsonb,
  pallet_count INT,
  pallet_dimensions TEXT,
  pallet_weight_lb NUMERIC(10,2),
  crating_method TEXT,

  -- ── Carrier handoff ──
  carrier_name TEXT,
  carrier_pro_number TEXT,
  carrier_bol_number TEXT,
  carrier_pickup_appointment_at TIMESTAMPTZ,
  ready_for_carrier_at TIMESTAMPTZ,
  handed_off_at TIMESTAMPTZ,
  handed_off_by TEXT,
  handoff_photos JSONB DEFAULT '[]'::jsonb,
  handoff_signature_url TEXT,
  handoff_signature_name TEXT,

  -- ── Lifecycle ──
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- ── Pricing components ──
  pickup_price NUMERIC(10,2) DEFAULT 0,
  palletization_price NUMERIC(10,2) DEFAULT 0,
  warehouse_intake_fee NUMERIC(10,2) DEFAULT 0,
  hold_days INT DEFAULT 0,
  free_hold_days INT DEFAULT 3,
  hold_price_per_day NUMERIC(10,2) DEFAULT 0,
  hold_price_total NUMERIC(10,2) DEFAULT 0,
  declared_value_fee NUMERIC(10,2) DEFAULT 0,
  subtotal NUMERIC(10,2),
  tax_amount NUMERIC(10,2),
  total_price NUMERIC(10,2),
  billing_method TEXT DEFAULT 'partner_invoice',

  -- ── Quote + invoice links ──
  quote_id UUID,
  invoice_sent BOOLEAN DEFAULT FALSE,
  invoice_sent_at TIMESTAMPTZ,
  invoice_id TEXT,
  square_invoice_id TEXT,
  partner_paid_at TIMESTAMPTZ,

  -- ── Operations ──
  assigned_crew_members JSONB DEFAULT '[]'::jsonb,
  internal_notes TEXT,
  partner_tracking_token TEXT UNIQUE,

  -- ── Status + timestamps ──
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'scheduled',
    'picked_up',
    'at_warehouse',
    'palletizing',
    'ready_for_carrier',
    'handed_off',
    'completed',
    'cancelled'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  vertical_code TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbound_shipments_org      ON public.outbound_shipments(organization_id);
CREATE INDEX IF NOT EXISTS idx_outbound_shipments_partner  ON public.outbound_shipments(partner_id);
CREATE INDEX IF NOT EXISTS idx_outbound_shipments_status   ON public.outbound_shipments(status);
CREATE INDEX IF NOT EXISTS idx_outbound_shipments_pickup   ON public.outbound_shipments(scheduled_pickup_date);
CREATE INDEX IF NOT EXISTS idx_outbound_shipments_quote    ON public.outbound_shipments(quote_id);
CREATE INDEX IF NOT EXISTS idx_outbound_shipments_token    ON public.outbound_shipments(partner_tracking_token);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.set_outbound_shipments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_outbound_shipments_updated_at_trg ON public.outbound_shipments;
CREATE TRIGGER set_outbound_shipments_updated_at_trg
  BEFORE UPDATE ON public.outbound_shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_outbound_shipments_updated_at();

-- Auto-assign shipment_number on insert (OS-NNNNN, monotonically counted).
-- We keep it text so leading zeros and prefix renames are easy.
CREATE OR REPLACE FUNCTION public.set_outbound_shipment_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_seq INT;
BEGIN
  IF NEW.shipment_number IS NULL OR NEW.shipment_number = '' THEN
    -- Compute next monotonic suffix across all outbound shipments. Coarse but
    -- correct under PG row-level locking; we accept a small race window for
    -- the very rare case of two simultaneous inserts (the UNIQUE constraint
    -- on shipment_number will reject collisions and the caller can retry).
    SELECT COALESCE(
      MAX(NULLIF(regexp_replace(shipment_number, '^OS-', ''), '')::INT),
      0
    ) + 1
    INTO next_seq
    FROM public.outbound_shipments
    WHERE shipment_number ~ '^OS-[0-9]+$';
    NEW.shipment_number := 'OS-' || LPAD(next_seq::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_outbound_shipment_number_trg ON public.outbound_shipments;
CREATE TRIGGER set_outbound_shipment_number_trg
  BEFORE INSERT ON public.outbound_shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_outbound_shipment_number();

COMMENT ON TABLE public.outbound_shipments IS
  'B2B reverse-logistics: Yugo picks up from a residential consignor, palletizes at the warehouse, hands off to a 3rd-party carrier. Mirror of inbound_shipments but the directionality is reversed.';
