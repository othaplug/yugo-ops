ALTER TABLE public.move_project_days
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
