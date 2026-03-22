-- Client inventory change requests (add/remove items before move) — distinct from move_change_requests (free-text operational requests).
-- API and product UI are implemented in application code; this migration provides the schema + RLS foundation.

CREATE TABLE IF NOT EXISTS public.inventory_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'admin_reviewing', 'approved', 'adjusted',
    'declined', 'client_confirming', 'confirmed', 'cancelled'
  )),
  items_added JSONB NOT NULL DEFAULT '[]'::jsonb,
  items_removed JSONB NOT NULL DEFAULT '[]'::jsonb,
  auto_calculated_delta NUMERIC NOT NULL DEFAULT 0,
  admin_adjusted_delta NUMERIC,
  admin_notes TEXT,
  decline_reason TEXT,
  original_subtotal NUMERIC,
  new_subtotal NUMERIC,
  additional_deposit_required NUMERIC NOT NULL DEFAULT 0,
  truck_assessment JSONB,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_change_requests_move_id
  ON public.inventory_change_requests (move_id);
CREATE INDEX IF NOT EXISTS idx_inventory_change_requests_status
  ON public.inventory_change_requests (status);
CREATE INDEX IF NOT EXISTS idx_inventory_change_requests_submitted_at
  ON public.inventory_change_requests (submitted_at DESC);

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS pending_inventory_change_request_id UUID
  REFERENCES public.inventory_change_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_moves_pending_inventory_cr
  ON public.moves (pending_inventory_change_request_id)
  WHERE pending_inventory_change_request_id IS NOT NULL;

ALTER TABLE public.inventory_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users full access inventory_change_requests" ON public.inventory_change_requests;
CREATE POLICY "Platform users full access inventory_change_requests"
  ON public.inventory_change_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Clients can insert inventory_change_requests for own moves" ON public.inventory_change_requests;
CREATE POLICY "Clients can insert inventory_change_requests for own moves"
  ON public.inventory_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.moves m
      WHERE m.id = inventory_change_requests.move_id
      AND m.client_email IS NOT NULL
      AND LOWER(TRIM(m.client_email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid())))
    )
  );

DROP POLICY IF EXISTS "Clients can select own inventory_change_requests" ON public.inventory_change_requests;
CREATE POLICY "Clients can select own inventory_change_requests"
  ON public.inventory_change_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.moves m
      WHERE m.id = inventory_change_requests.move_id
      AND m.client_email IS NOT NULL
      AND LOWER(TRIM(m.client_email)) = LOWER(TRIM((SELECT email FROM auth.users WHERE id = auth.uid())))
    )
    OR EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );

INSERT INTO public.platform_config (key, value, description) VALUES
  ('change_request_enabled', 'true', 'Allow client inventory change requests before move'),
  ('change_request_per_score_rate', '35', 'Dollars per weight-score unit for add/remove pricing'),
  ('change_request_min_hours_before_move', '48', 'Minimum hours before move date to allow a request'),
  ('change_request_max_items_per_request', '10', 'Max line items (add + remove) per submission')
ON CONFLICT (key) DO NOTHING;
