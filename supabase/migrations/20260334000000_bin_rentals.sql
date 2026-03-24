-- ═══════════════════════════════════════════════════════════════
-- BIN RENTALS — Plastic Bin Rental System
-- Revenue stream: eco-friendly bins for DIY movers
-- ═══════════════════════════════════════════════════════════════

-- ── 1. bin_orders table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bin_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,

  -- Client
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,

  -- Delivery
  delivery_address TEXT NOT NULL,
  delivery_postal TEXT,
  delivery_access TEXT DEFAULT 'elevator',
  delivery_notes TEXT,

  -- Bundle
  bundle_type TEXT NOT NULL CHECK (bundle_type IN (
    'individual', 'studio', '1br', '2br', '3br', '4br_plus'
  )),
  bin_count INTEGER NOT NULL,
  includes_paper BOOLEAN DEFAULT TRUE,
  includes_zip_ties BOOLEAN DEFAULT TRUE,

  -- Dates
  move_date DATE NOT NULL,
  drop_off_date DATE NOT NULL,
  pickup_date DATE NOT NULL,

  -- Status
  status TEXT DEFAULT 'confirmed' CHECK (status IN (
    'confirmed', 'drop_off_scheduled', 'bins_delivered',
    'in_use', 'pickup_scheduled', 'bins_collected',
    'completed', 'overdue', 'cancelled'
  )),

  -- Pricing
  bundle_price NUMERIC NOT NULL,
  delivery_surcharge NUMERIC DEFAULT 0,
  late_return_fees NUMERIC DEFAULT 0,
  subtotal NUMERIC NOT NULL,
  hst NUMERIC NOT NULL,
  total NUMERIC NOT NULL,

  -- Payment
  square_payment_id TEXT,
  square_customer_id TEXT,
  square_card_id TEXT,
  payment_status TEXT DEFAULT 'paid',

  -- Linked move (optional)
  move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,

  -- Drop-off tracking
  drop_off_completed_at TIMESTAMPTZ,
  drop_off_crew TEXT,
  drop_off_photos JSONB DEFAULT '[]',

  -- Pickup tracking
  pickup_completed_at TIMESTAMPTZ,
  pickup_crew TEXT,
  pickup_photos JSONB DEFAULT '[]',
  bins_returned INTEGER,
  bins_missing INTEGER DEFAULT 0,
  missing_bin_charge NUMERIC DEFAULT 0,

  -- Overdue tracking
  overdue_notified_day1 BOOLEAN DEFAULT FALSE,
  overdue_notified_day2 BOOLEAN DEFAULT FALSE,
  overdue_days INTEGER DEFAULT 0,
  overdue_last_charged_at TIMESTAMPTZ,

  -- Source
  source TEXT DEFAULT 'standalone' CHECK (source IN ('standalone', 'move_addon', 'admin')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bin_orders_status ON public.bin_orders(status);
CREATE INDEX IF NOT EXISTS idx_bin_orders_drop_off_date ON public.bin_orders(drop_off_date);
CREATE INDEX IF NOT EXISTS idx_bin_orders_pickup_date ON public.bin_orders(pickup_date);
CREATE INDEX IF NOT EXISTS idx_bin_orders_move_date ON public.bin_orders(move_date);
CREATE INDEX IF NOT EXISTS idx_bin_orders_move_id ON public.bin_orders(move_id);
CREATE INDEX IF NOT EXISTS idx_bin_orders_client_email ON public.bin_orders(client_email);
CREATE INDEX IF NOT EXISTS idx_bin_orders_order_number ON public.bin_orders(order_number);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_bin_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_bin_orders_updated_at ON public.bin_orders;
CREATE TRIGGER trg_bin_orders_updated_at
  BEFORE UPDATE ON public.bin_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_bin_orders_updated_at();

-- ── 2. RLS ───────────────────────────────────────────────────────

ALTER TABLE public.bin_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can manage bin_orders" ON public.bin_orders;
CREATE POLICY "Platform users can manage bin_orders"
  ON public.bin_orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ── 3. platform_config — bin rental pricing ───────────────────────

INSERT INTO public.platform_config (key, value, description) VALUES
  ('bin_rental_bundles', '{"studio":{"price":109,"bins":15,"includes":"15 bins + packing paper + zip ties"},"1br":{"price":189,"bins":30,"includes":"30 bins + packing paper + zip ties"},"2br":{"price":289,"bins":50,"includes":"50 bins + packing paper + zip ties"},"3br":{"price":429,"bins":75,"includes":"75 bins + packing paper + zip ties"},"4br_plus":{"price":579,"bins":100,"includes":"100 bins + packing paper + zip ties"}}', 'Bin rental bundle pricing by size'),
  ('bin_rental_individual_price', '6', 'Price per individual bin ($)'),
  ('bin_rental_individual_minimum', '5', 'Minimum bins for individual order'),
  ('bin_rental_delivery_surcharge_gta', '35', 'GTA suburb delivery surcharge ($)'),
  ('bin_rental_rental_days', '12', 'Total rental period in days'),
  ('bin_rental_drop_off_days_before', '7', 'Days before move date to drop off bins'),
  ('bin_rental_pickup_days_after', '5', 'Days after move date to pick up bins'),
  ('bin_rental_late_fee_per_day', '10', 'Late return fee per day ($)'),
  ('bin_rental_missing_bin_fee', '20', 'Fee per missing bin ($)'),
  ('bin_rental_gta_surcharge_postals', '["L4","L5","L6","L3","L1"]', 'Postal prefixes that trigger GTA surcharge'),
  ('bin_rental_hst_rate', '0.13', 'HST rate applied to bin orders'),
  ('bin_rental_enabled', 'true', 'Enable/disable bin rental feature')
ON CONFLICT (key) DO NOTHING;

-- ── 5. Plastic bin rental add-on ─────────────────────────────────

INSERT INTO public.addons (
  name, slug, description, price, price_type, tiers,
  applicable_service_types, excluded_tiers,
  is_popular, display_order, active
) VALUES (
  'Plastic bin rental',
  'plastic_bin_rental',
  'Eco-friendly bins delivered 7 days before your move. Picked up 5 days after. No cardboard waste.',
  109,
  'tiered',
  '[
    {"label": "Studio (15 bins)", "price": 109, "bundle": "studio", "bins": 15},
    {"label": "1 Bedroom (30 bins)", "price": 189, "bundle": "1br", "bins": 30},
    {"label": "2 Bedroom (50 bins)", "price": 289, "bundle": "2br", "bins": 50},
    {"label": "3 Bedroom (75 bins)", "price": 429, "bundle": "3br", "bins": 75},
    {"label": "4 Bedroom+ (100 bins)", "price": 579, "bundle": "4br_plus", "bins": 100}
  ]'::jsonb,
  '{local_move,long_distance}',
  NULL,
  true,
  16,
  true
) ON CONFLICT (slug) DO NOTHING;
