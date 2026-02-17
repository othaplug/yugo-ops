-- Client documents: documents linked to a client/partner (org) or move
CREATE TABLE IF NOT EXISTS public.client_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  move_id UUID REFERENCES public.moves(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  storage_path TEXT,
  type TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('contract', 'estimate', 'invoice', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_doc_org_or_move CHECK (
    (organization_id IS NOT NULL AND move_id IS NULL) OR
    (organization_id IS NULL AND move_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_client_documents_org ON public.client_documents (organization_id);
CREATE INDEX IF NOT EXISTS idx_client_documents_move ON public.client_documents (move_id);

ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform users can manage client_documents"
  ON public.client_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- Clients can read their own (by move client_email)
CREATE POLICY "Clients can read own move client_documents"
  ON public.client_documents FOR SELECT TO authenticated
  USING (
    move_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.moves m
      WHERE m.id = client_documents.move_id
      AND LOWER(m.client_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

-- Partners can read their org's documents
CREATE POLICY "Partners can read own org client_documents"
  ON public.client_documents FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT org_id FROM public.partner_users WHERE user_id = auth.uid())
  );

-- Storage bucket for client documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Platform users can manage client documents storage"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'client-documents'
    AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );

-- Client/partner read: handled via API signed URLs (RLS on client_documents controls access)
