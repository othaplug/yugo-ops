-- Link moves to crews for client live tracking
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_moves_crew_id ON public.moves (crew_id);
