-- Multi-stop B2B: structured stop items, extended stop + delivery metadata, pricing config

-- ── delivery_stop_items: per-stop line items for crew checklists ─────────────
CREATE TABLE IF NOT EXISTS public.delivery_stop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id UUID NOT NULL REFERENCES public.delivery_stops(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  weight_range TEXT DEFAULT 'standard',
  is_fragile BOOLEAN DEFAULT FALSE,
  is_high_value BOOLEAN DEFAULT FALSE,
  requires_assembly BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending',
  checked_by TEXT,
  checked_at TIMESTAMPTZ,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stop_items_stop_id ON public.delivery_stop_items(stop_id);

ALTER TABLE public.delivery_stop_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stop_items_admin" ON public.delivery_stop_items;
CREATE POLICY "stop_items_admin" ON public.delivery_stop_items
  FOR ALL USING (true) WITH CHECK (true);

-- ── delivery_stops: vendor / access / readiness / phasing ─────────────────────
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS vendor_name TEXT;
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'ground_floor';
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS access_notes TEXT;
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS readiness TEXT DEFAULT 'confirmed';
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS readiness_notes TEXT;
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER DEFAULT 30;
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS is_final_destination BOOLEAN DEFAULT FALSE;
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS sequence_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.delivery_stops ADD COLUMN IF NOT EXISTS delivery_phase INTEGER DEFAULT 1;

-- ── deliveries: multi-stop job flags ───────────────────────────────────────────
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS is_multi_stop BOOLEAN DEFAULT FALSE;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS total_stops INTEGER DEFAULT 2;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS project_name TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS end_client_name TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS end_client_phone TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS route_optimized BOOLEAN DEFAULT FALSE;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS staged_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS phase_count INTEGER DEFAULT 1;

INSERT INTO public.platform_config (key, value, description) VALUES
  (
    'b2b_multi_stop_surcharge',
    '75',
    'Per additional pickup stop beyond the first. Covers extra drive time and vendor coordination.'
  )
ON CONFLICT (key) DO NOTHING;
