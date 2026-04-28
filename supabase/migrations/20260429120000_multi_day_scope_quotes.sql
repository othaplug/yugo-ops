-- Move scope on quotes (Phase A), platform rates, move_projects.move link,
-- move_project_days operational columns (Phase B).

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS estimated_days INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS day_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS multi_location BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS additional_origins JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS additional_destinations JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.move_projects ADD COLUMN IF NOT EXISTS move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL;
ALTER TABLE public.move_projects ADD COLUMN IF NOT EXISTS current_day INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_move_projects_move_id ON public.move_projects(move_id);

ALTER TABLE public.move_project_days ADD COLUMN IF NOT EXISTS crew_assigned JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.move_project_days ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE public.move_project_days ADD COLUMN IF NOT EXISTS stages JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.move_project_days ADD COLUMN IF NOT EXISTS current_stage TEXT;
ALTER TABLE public.move_project_days ADD COLUMN IF NOT EXISTS requires_pod BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.move_project_days ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.move_project_days ADD COLUMN IF NOT EXISTS completion_photos JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.move_project_days.requires_pod IS 'Proof of delivery required when completing this day (typically move day only).';

INSERT INTO public.platform_config (key, value, description) VALUES
  ('multi_day_rate', '850', 'Cost per additional move or crating day. Covers crew plus truck for a full day.'),
  ('pack_day_rate', '650', 'Cost per packing or unpacking day. Crew-focused rate without truck.')
ON CONFLICT (key) DO NOTHING;
