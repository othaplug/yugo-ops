-- Storage bucket for move documents (contracts, estimates, PDFs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'move-documents',
  'move-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Clients can read documents for their own moves
CREATE POLICY "Clients can read own move documents storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'move-documents'
    AND EXISTS (
      SELECT 1 FROM public.moves m
      WHERE m.id::text = (storage.foldername(name))[1]
      AND LOWER(m.client_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

-- Platform users can manage move documents storage
CREATE POLICY "Platform users can manage move documents storage"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'move-documents'
    AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'move-documents'
    AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );
