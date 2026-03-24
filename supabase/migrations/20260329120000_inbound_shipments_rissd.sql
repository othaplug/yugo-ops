-- ═══════════════════════════════════════════════════════════════
-- RISSD — Receive, Inspect, Store & Deliver (inbound luxury retail)
-- ═══════════════════════════════════════════════════════════════

-- Shipment number SHP-0001
CREATE OR REPLACE FUNCTION public.generate_inbound_shipment_number()
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  n INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    (regexp_match(shipment_number, '^SHP-(\d+)$'))[1]::integer
  ), 0) + 1 INTO n FROM public.inbound_shipments;
  RETURN 'SHP-' || LPAD(n::text, 4, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS public.inbound_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number TEXT NOT NULL UNIQUE,

  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  partner_name TEXT,
  partner_contact_name TEXT,
  partner_contact_email TEXT,
  partner_contact_phone TEXT,

  business_name TEXT,
  business_email TEXT,
  business_phone TEXT,

  carrier_name TEXT,
  carrier_tracking_number TEXT,
  carrier_eta DATE,

  items JSONB NOT NULL DEFAULT '[]',
  total_pieces INTEGER DEFAULT 1,

  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  customer_postal TEXT,
  customer_access TEXT,
  customer_notes TEXT,
  customer_provided_at TIMESTAMPTZ,

  service_level TEXT DEFAULT 'white_glove' CHECK (service_level IN (
    'standard', 'white_glove', 'premium'
  )),
  requires_move_inside BOOLEAN DEFAULT TRUE,
  requires_assembly BOOLEAN DEFAULT FALSE,
  requires_unboxing BOOLEAN DEFAULT TRUE,
  requires_debris_removal BOOLEAN DEFAULT TRUE,
  requires_pod BOOLEAN DEFAULT TRUE,
  receiving_inspection_tier TEXT DEFAULT 'detailed' CHECK (receiving_inspection_tier IN (
    'standard', 'detailed'
  )),
  assembly_complexity TEXT CHECK (assembly_complexity IS NULL OR assembly_complexity IN (
    'simple', 'moderate', 'complex'
  )),
  special_instructions TEXT,
  partner_issue_phone TEXT,

  received_at TIMESTAMPTZ,
  received_by TEXT,
  inspection_status TEXT CHECK (inspection_status IS NULL OR inspection_status IN (
    'pending', 'good', 'damaged', 'partial_damage'
  )),
  inspection_notes TEXT,
  inspection_photos JSONB DEFAULT '[]',
  inspection_items JSONB DEFAULT '[]',

  storage_location TEXT,
  storage_start_date DATE,
  storage_days INTEGER DEFAULT 0,
  storage_fee_per_day NUMERIC DEFAULT 0,
  storage_total NUMERIC DEFAULT 0,

  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  delivery_scheduled_date DATE,
  delivery_window TEXT,
  delivery_crew TEXT,

  pod_captured BOOLEAN DEFAULT FALSE,
  pod_signature TEXT,
  pod_photo_url TEXT,
  pod_signed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  delivery_price NUMERIC,
  assembly_price NUMERIC DEFAULT 0,
  storage_price NUMERIC DEFAULT 0,
  receiving_fee NUMERIC,
  total_price NUMERIC,

  billing_method TEXT DEFAULT 'partner' CHECK (billing_method IN (
    'partner', 'customer', 'split'
  )),
  invoice_sent BOOLEAN DEFAULT FALSE,
  invoice_id UUID,

  partner_resolution_choice TEXT,
  partner_resolution_notes TEXT,

  status TEXT DEFAULT 'awaiting_shipment' CHECK (status IN (
    'awaiting_shipment',
    'in_transit',
    'received',
    'inspecting',
    'inspection_failed',
    'stored',
    'customer_contacted',
    'delivery_scheduled',
    'out_for_delivery',
    'delivered',
    'completed',
    'cancelled'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_shipments_org ON public.inbound_shipments(organization_id);
CREATE INDEX IF NOT EXISTS idx_inbound_shipments_status ON public.inbound_shipments(status);
CREATE INDEX IF NOT EXISTS idx_inbound_shipments_delivery ON public.inbound_shipments(delivery_id);
CREATE INDEX IF NOT EXISTS idx_inbound_shipments_created ON public.inbound_shipments(created_at DESC);

CREATE OR REPLACE FUNCTION public.inbound_shipments_set_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.shipment_number IS NULL OR NEW.shipment_number = '' THEN
    NEW.shipment_number := public.generate_inbound_shipment_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inbound_shipments_number ON public.inbound_shipments;
CREATE TRIGGER trg_inbound_shipments_number
  BEFORE INSERT ON public.inbound_shipments
  FOR EACH ROW EXECUTE FUNCTION public.inbound_shipments_set_number();

DROP TRIGGER IF EXISTS trg_inbound_shipments_updated_at ON public.inbound_shipments;
CREATE TRIGGER trg_inbound_shipments_updated_at
  BEFORE UPDATE ON public.inbound_shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.shipment_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES public.inbound_shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  notes TEXT,
  photos JSONB DEFAULT '[]',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_status_log_shipment ON public.shipment_status_log(shipment_id, created_at DESC);

ALTER TABLE public.inbound_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_status_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users manage inbound_shipments" ON public.inbound_shipments;
CREATE POLICY "Platform users manage inbound_shipments"
  ON public.inbound_shipments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partners read own inbound_shipments" ON public.inbound_shipments;
CREATE POLICY "Partners read own inbound_shipments"
  ON public.inbound_shipments FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.partner_users pu
      WHERE pu.user_id = auth.uid() AND pu.org_id = inbound_shipments.organization_id
    )
  );

DROP POLICY IF EXISTS "Platform users manage shipment_status_log" ON public.shipment_status_log;
CREATE POLICY "Platform users manage shipment_status_log"
  ON public.shipment_status_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Partners read shipment_status_log for own shipments" ON public.shipment_status_log;
CREATE POLICY "Partners read shipment_status_log for own shipments"
  ON public.shipment_status_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inbound_shipments s
      JOIN public.partner_users pu ON pu.org_id = s.organization_id AND pu.user_id = auth.uid()
      WHERE s.id = shipment_status_log.shipment_id
    )
  );

INSERT INTO public.platform_config (key, value, description) VALUES
  ('rissd_receiving_fee_standard', '50', 'RISSD receiving + quick visual inspection ($)'),
  ('rissd_receiving_fee_detailed', '100', 'RISSD detailed inspection ($)'),
  ('rissd_storage_free_days', '3', 'Free storage days before daily rate'),
  ('rissd_storage_daily_rate', '15', 'Storage per day after free period ($)'),
  ('rissd_assembly_simple', '85', 'RISSD assembly simple tier ($)'),
  ('rissd_assembly_moderate', '150', 'RISSD assembly moderate tier ($)'),
  ('rissd_assembly_complex', '250', 'RISSD assembly complex tier ($)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inbound-shipment-photos',
  'inbound-shipment-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;
