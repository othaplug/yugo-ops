-- C4 Photos: Storage bucket + move_photos table for metadata
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'move-photos',
  'move-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Clients can read photos for their own moves
CREATE POLICY "Clients can read own move photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'move-photos'
    AND EXISTS (
      SELECT 1 FROM public.moves m
      WHERE m.id::text = (storage.foldername(name))[1]
      AND LOWER(m.client_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

-- Platform users can manage move photos
CREATE POLICY "Platform users can manage move photos"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'move-photos'
    AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'move-photos'
    AND EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid())
  );

-- Metadata table for captions, ordering
CREATE TABLE IF NOT EXISTS public.move_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_move_photos_move_id ON public.move_photos (move_id);

ALTER TABLE public.move_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can read own move photos metadata"
  ON public.move_photos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.moves m
      WHERE m.id = move_photos.move_id
      AND LOWER(m.client_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

CREATE POLICY "Platform users can manage move_photos"
  ON public.move_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
