-- Add source column to move_photos to distinguish admin vs client uploads
ALTER TABLE public.move_photos ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'admin';

-- Add expires_at for 30-day retention on client uploads
ALTER TABLE public.move_photos ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
