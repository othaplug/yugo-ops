-- Prompt 75: Proof of Delivery table
-- Prompt 76: Tracking codes
-- Prompt 77: (no schema changes - uses existing tables)
-- Prompt 78: Multi-vendor project inventory

-- ═══════════════════════════════════════════════════
-- PROMPT 75: PROOF OF DELIVERY
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.proof_of_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID REFERENCES public.moves(id),
  delivery_id UUID REFERENCES public.deliveries(id),
  delivery_stop_index INTEGER,

  photos_pickup JSONB DEFAULT '[]',
  photos_transit JSONB DEFAULT '[]',
  photos_delivery JSONB DEFAULT '[]',

  item_conditions JSONB DEFAULT '[]',

  signature_data TEXT,
  signer_name TEXT,
  signed_at TIMESTAMPTZ,

  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  satisfaction_comment TEXT,

  crew_members TEXT[],
  gps_lat NUMERIC,
  gps_lng NUMERIC,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  pdf_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pod_move ON public.proof_of_delivery (move_id);
CREATE INDEX IF NOT EXISTS idx_pod_delivery ON public.proof_of_delivery (delivery_id);

ALTER TABLE public.proof_of_delivery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform users manage pod" ON public.proof_of_delivery;
CREATE POLICY "Platform users manage pod"
  ON public.proof_of_delivery FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- Add pdf_url to client_sign_offs for linking generated PDF
ALTER TABLE public.client_sign_offs ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE public.client_sign_offs ADD COLUMN IF NOT EXISTS item_conditions JSONB DEFAULT '[]';

-- Storage bucket for PoD PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('pod-documents', 'pod-documents', true, 10485760, ARRAY['application/pdf', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════
-- PROMPT 76: TRACKING CODES
-- ═══════════════════════════════════════════════════

ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS tracking_code TEXT UNIQUE;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS tracking_code TEXT UNIQUE;

-- Partner customer notification preferences (persisted to DB)
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS customer_notifications_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS customer_notification_message TEXT;

-- ═══════════════════════════════════════════════════
-- PROMPT 78: MULTI-VENDOR PROJECT INVENTORY
-- ═══════════════════════════════════════════════════

ALTER TABLE public.project_inventory ADD COLUMN IF NOT EXISTS
  handled_by TEXT DEFAULT 'yugo' CHECK (handled_by IN ('yugo', 'vendor_direct', 'other_carrier'));

ALTER TABLE public.project_inventory ADD COLUMN IF NOT EXISTS
  vendor_tracking_number TEXT;

ALTER TABLE public.project_inventory ADD COLUMN IF NOT EXISTS
  vendor_carrier TEXT;

ALTER TABLE public.project_inventory ADD COLUMN IF NOT EXISTS
  expected_delivery_date DATE;
