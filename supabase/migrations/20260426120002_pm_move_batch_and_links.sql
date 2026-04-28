-- PM coordinator batch moves: linking, holding unit, packing flag, tenant presence for crew flow.

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS is_pm_move BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS linked_move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS linked_move_code TEXT;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS holding_unit TEXT;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS pm_packing_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS pm_building_code TEXT;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS tenant_present BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS pm_pricing_source TEXT;

CREATE INDEX IF NOT EXISTS idx_moves_linked_move ON public.moves (linked_move_id) WHERE linked_move_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_moves_is_pm_move ON public.moves (is_pm_move) WHERE is_pm_move = TRUE;
