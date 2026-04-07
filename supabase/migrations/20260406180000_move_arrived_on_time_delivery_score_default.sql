-- Move punctuality: set when crew hits arrived_at_pickup vs scheduled window.
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS arrived_on_time BOOLEAN;

COMMENT ON COLUMN public.moves.arrived_on_time IS
  'NULL = not scored; true/false = first scored arrived_at_pickup vs scheduled_date + window.';

-- New deliveries omitting the column should be unscored until a checkpoint runs.
ALTER TABLE public.deliveries
  ALTER COLUMN score_arrived_late DROP DEFAULT;

COMMENT ON COLUMN public.deliveries.score_arrived_late IS
  'NULL = not scored; false = on time at destination vs window; true = late.';
