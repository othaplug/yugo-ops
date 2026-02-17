-- Invoices: link to client/partner org, add PDF file storage (no Square sync)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS file_path TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices (organization_id);

-- Storage bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-files',
  'invoice-files',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Platform users manage invoice files
CREATE POLICY "Platform users can manage invoice files"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'invoice-files'
    AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'invoice-files'
    AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );

-- Clients/partners can read their own invoice files (by org or move)
CREATE POLICY "Clients can read own invoice files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoice-files'
    AND EXISTS (
      SELECT 1 FROM public.invoices inv
      LEFT JOIN public.moves m ON inv.move_id = m.id
      WHERE inv.id::text = split_part(name, '/', 1)
      AND (
        (inv.organization_id IN (SELECT org_id FROM public.partner_users WHERE user_id = auth.uid()))
        OR (m.id IS NOT NULL AND LOWER(m.client_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())))
      )
    )
  );
