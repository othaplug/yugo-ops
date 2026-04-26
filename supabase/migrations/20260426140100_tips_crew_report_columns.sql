-- Tips: crew-reported cash / none, deliveries, and job metadata for analytics
ALTER TABLE tips DROP CONSTRAINT IF EXISTS tips_move_id_key;

ALTER TABLE tips ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'move';
ALTER TABLE tips ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'square';
ALTER TABLE tips ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tips ADD COLUMN IF NOT EXISTS reported_by UUID REFERENCES public.crew_members(id) ON DELETE SET NULL;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS service_type TEXT;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS tier TEXT;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS neighbourhood TEXT;
ALTER TABLE tips ADD COLUMN IF NOT EXISTS report_note TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tips_unique_move ON public.tips (move_id) WHERE move_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tips_unique_delivery ON public.tips (delivery_id) WHERE delivery_id IS NOT NULL;

UPDATE public.tips SET job_type = 'move' WHERE COALESCE(trim(job_type), '') = '';

ALTER TABLE tips ALTER COLUMN move_id DROP NOT NULL;
