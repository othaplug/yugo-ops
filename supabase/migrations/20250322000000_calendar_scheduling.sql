-- Calendar scheduling: structured time blocks, crew schedule blocks, duration defaults

-- ── Moves: add time-block + calendar fields ──
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS scheduled_start TIME;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS scheduled_end TIME;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS assigned_truck_id UUID REFERENCES public.fleet_vehicles(id);
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS calendar_color TEXT DEFAULT '#B8962E';
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS calendar_status TEXT DEFAULT 'scheduled';

-- ── Deliveries: add time-block + calendar fields ──
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS scheduled_start TIME;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS scheduled_end TIME;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS estimated_duration_hours NUMERIC(4,1);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS assigned_truck_id UUID REFERENCES public.fleet_vehicles(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS calendar_color TEXT DEFAULT '#2C3E2D';
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS calendar_status TEXT DEFAULT 'scheduled';

-- ── Organizations: add payment_term_days for overdue logic ──
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS payment_term_days INTEGER DEFAULT 0;

-- ── Crew schedule blocks ──
CREATE TABLE IF NOT EXISTS public.crew_schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  block_start TIME NOT NULL,
  block_end TIME NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN (
    'move','delivery','project_phase','maintenance',
    'training','break','blocked','time_off'
  )),
  reference_id UUID,
  reference_type TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.crew_schedule_blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_crew_schedule_blocks') THEN
    CREATE POLICY service_role_crew_schedule_blocks ON public.crew_schedule_blocks FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crew_blocks_date ON public.crew_schedule_blocks(block_date);
CREATE INDEX IF NOT EXISTS idx_crew_blocks_crew_date ON public.crew_schedule_blocks(crew_id, block_date);

-- ── Indexes for calendar queries on moves/deliveries ──
CREATE INDEX IF NOT EXISTS idx_moves_scheduled_date ON public.moves(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_scheduled_date ON public.deliveries(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_moves_calendar_status ON public.moves(calendar_status);
CREATE INDEX IF NOT EXISTS idx_deliveries_calendar_status ON public.deliveries(calendar_status);

-- ── Duration estimation defaults ──
CREATE TABLE IF NOT EXISTS public.duration_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  sub_type TEXT,
  default_hours NUMERIC(4,1) NOT NULL,
  min_hours NUMERIC(4,1),
  max_hours NUMERIC(4,1),
  notes TEXT,
  UNIQUE(job_type, sub_type)
);

ALTER TABLE public.duration_defaults ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_duration_defaults') THEN
    CREATE POLICY service_role_duration_defaults ON public.duration_defaults FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

INSERT INTO public.duration_defaults (job_type, sub_type, default_hours, min_hours, max_hours, notes)
VALUES
  ('move', 'studio',    3.0, 2.0, 4.5,  'Studio apartment, 2-person crew'),
  ('move', '1br',       4.0, 3.0, 5.5,  '1-bedroom, 2-person crew'),
  ('move', '2br',       5.5, 4.0, 7.0,  '2-bedroom, 3-person crew'),
  ('move', '3br',       7.0, 5.5, 9.0,  '3-bedroom, 3-4 person crew'),
  ('move', '4br',       8.5, 7.0, 11.0, '4-bedroom, 4-person crew'),
  ('move', '5br_plus',  10.0, 8.0, 14.0, '5+ bedroom, 4-5 person crew'),
  ('move', 'office',    6.0, 4.0, 10.0, 'Office move, varies by size'),
  ('delivery', 'standard',      1.5, 0.5, 3.0,  'Standard white-glove delivery'),
  ('delivery', 'multi_piece',   2.5, 1.5, 4.0,  'Multi-piece furniture set'),
  ('delivery', 'assembly_req',  3.0, 2.0, 5.0,  'Delivery with assembly'),
  ('delivery', 'art_specialty', 2.0, 1.0, 4.0,  'Art/specialty handling'),
  ('delivery', 'medical',       2.5, 1.5, 4.0,  'Medical equipment install'),
  ('project_phase', 'default',  4.0, 2.0, 8.0,  'Project phase default')
ON CONFLICT (job_type, sub_type) DO NOTHING;

-- ── Realtime for schedule blocks ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'crew_schedule_blocks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_schedule_blocks;
  END IF;
END $$;
