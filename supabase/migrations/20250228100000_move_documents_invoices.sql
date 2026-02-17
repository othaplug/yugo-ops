-- C7 Documents: Link invoices to moves, add move_documents for contracts etc.
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_move_id ON public.invoices (move_id);

-- move_documents: contracts, estimates, other PDFs tied to moves
CREATE TABLE IF NOT EXISTS public.move_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('contract', 'estimate', 'invoice', 'other')),
  title TEXT NOT NULL,
  storage_path TEXT,
  external_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_move_documents_move_id ON public.move_documents (move_id);

ALTER TABLE public.move_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read own move documents"
  ON public.move_documents FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.moves m
      WHERE m.id = move_documents.move_id
      AND LOWER(m.client_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

CREATE POLICY "Platform users can manage move_documents"
  ON public.move_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- Clients can read invoices for their moves (by move_id or client_name match)
DROP POLICY IF EXISTS "Clients can read own move invoices" ON public.invoices;
CREATE POLICY "Clients can read own move invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.moves m
      WHERE LOWER(m.client_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
      AND (invoices.move_id = m.id OR (invoices.client_name IS NOT NULL AND m.client_name IS NOT NULL AND LOWER(invoices.client_name) = LOWER(m.client_name)))
    )
  );
