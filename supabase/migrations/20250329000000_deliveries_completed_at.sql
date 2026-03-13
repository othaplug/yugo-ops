-- Add completed_at to deliveries so post-completion logic (e.g. analytics, future crons) can use it.
-- Matches moves.completed_at (set when crew marks job complete in tracking checkpoint).
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
