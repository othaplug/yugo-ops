-- Clear the model-estimated duration for MV-30209 so the UI falls back to
-- the coordinator's est_hours (5 h), which is already stored on the move row.
-- The estimation model produced 2:33 because white_glove service type used the
-- catch-all 75-minute loading estimate instead of the coordinator's explicit hours.
UPDATE public.moves
SET
  estimated_duration_minutes = NULL,
  margin_alert_minutes       = NULL
WHERE move_code = 'MV-30209';
