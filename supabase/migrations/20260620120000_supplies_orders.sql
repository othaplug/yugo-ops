-- Supplies orders: clients buy packing supplies from their track-move page
-- after booking. One-tap charge against the card on file; supplies arrive with
-- the crew on move day. Products reuse the existing residential supply add-ons.

CREATE TABLE IF NOT EXISTS public.supplies_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,

  -- Linked move (the order is always placed from a move's track page)
  move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,

  -- Client snapshot at time of purchase
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,

  -- Line items: [{ slug, name, unit_label, unit_price, quantity, line_total }]
  items JSONB NOT NULL DEFAULT '[]',

  -- Pricing
  subtotal NUMERIC NOT NULL,
  hst NUMERIC NOT NULL,
  total NUMERIC NOT NULL,

  -- Payment
  square_payment_id TEXT,
  square_customer_id TEXT,
  square_card_id TEXT,
  payment_status TEXT DEFAULT 'paid',

  -- Fulfillment: supplies travel with the crew on move day
  fulfillment TEXT DEFAULT 'with_crew',
  status TEXT DEFAULT 'confirmed' CHECK (status IN (
    'confirmed', 'fulfilled', 'cancelled', 'refunded'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplies_orders_move ON public.supplies_orders(move_id);
CREATE INDEX IF NOT EXISTS idx_supplies_orders_status ON public.supplies_orders(status);
CREATE INDEX IF NOT EXISTS idx_supplies_orders_created ON public.supplies_orders(created_at DESC);

ALTER TABLE public.supplies_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can manage supplies_orders" ON public.supplies_orders;
CREATE POLICY "Platform users can manage supplies_orders"
  ON public.supplies_orders FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
