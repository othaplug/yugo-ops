-- move_files: admin-uploaded or system files attached to a move
-- Supplements existing move_photos / move_documents with a unified upload record

CREATE TABLE IF NOT EXISTS public.move_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id     UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_type   TEXT NOT NULL,            -- 'image/jpeg', 'application/pdf', etc.
  category    TEXT DEFAULT 'document',  -- 'document' | 'photo' | 'pod'
  stage       TEXT,                     -- optional: 'pickup', 'transit', 'delivery'
  source      TEXT DEFAULT 'admin_upload', -- 'admin_upload' | 'crew' | 'system'
  uploaded_by UUID REFERENCES auth.users(id),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_move_files_move_id ON public.move_files(move_id);

ALTER TABLE public.move_files ENABLE ROW LEVEL SECURITY;

-- Admins and platform users can manage all move files
CREATE POLICY "platform_users_manage_move_files"
  ON public.move_files
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users
      WHERE user_id = auth.uid()
    )
  );
