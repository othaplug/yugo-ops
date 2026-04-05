-- Client track: Estate tier service-milestone checklist (separate from pre_move_checklist).
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS estate_service_checklist JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.moves.estate_service_checklist IS
  'Estate track: client-checked milestones (walkthrough, packing, move, unpacking).';
