-- Store which crew members are assigned to a move (subset of crew.members)
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS assigned_members JSONB DEFAULT '[]'::jsonb;
