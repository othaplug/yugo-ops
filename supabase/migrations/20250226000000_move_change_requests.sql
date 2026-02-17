-- Move change requests (C5) - client submits, admin reviews
CREATE TABLE IF NOT EXISTS public.move_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_move_change_requests_move_id ON public.move_change_requests (move_id);
CREATE INDEX IF NOT EXISTS idx_move_change_requests_status ON public.move_change_requests (status);

ALTER TABLE public.move_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can insert for own moves"
  ON public.move_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.moves m
      WHERE m.id = move_change_requests.move_id
      AND LOWER(m.client_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

CREATE POLICY "Authenticated can select own move change requests"
  ON public.move_change_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.moves m
      WHERE m.id = move_change_requests.move_id
      AND LOWER(m.client_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    OR EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Platform users can update move_change_requests"
  ON public.move_change_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (true);
