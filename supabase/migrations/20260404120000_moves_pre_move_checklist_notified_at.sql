-- One-time notification when client completes all pre-move checklist items from tracking.
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS pre_move_checklist_notified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.moves.pre_move_checklist_notified_at IS
  'Set when admin/coordinator were notified that the client completed the full pre-move checklist from the track page.';
