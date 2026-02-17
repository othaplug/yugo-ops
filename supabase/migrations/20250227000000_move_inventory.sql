-- Move inventory (C3) - rooms, items, status, box
CREATE TABLE IF NOT EXISTS public.move_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  room TEXT NOT NULL,
  item_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_packed' CHECK (status IN ('not_packed', 'packed', 'in_transit', 'delivered')),
  box_number TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_move_inventory_move_id ON public.move_inventory (move_id);
CREATE INDEX IF NOT EXISTS idx_move_inventory_room ON public.move_inventory (move_id, room);

ALTER TABLE public.move_inventory ENABLE ROW LEVEL SECURITY;

-- Clients can read inventory for their own moves
CREATE POLICY "Clients can read own move inventory"
  ON public.move_inventory FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.moves m
      WHERE m.id = move_inventory.move_id
      AND LOWER(m.client_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

-- Platform users can manage inventory
CREATE POLICY "Platform users can manage move_inventory"
  ON public.move_inventory FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
