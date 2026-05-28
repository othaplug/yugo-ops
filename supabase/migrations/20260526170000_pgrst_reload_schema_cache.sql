-- Force PostgREST to reload its schema cache.
--
-- The deposit_method / deposit_paid / deposit_note columns added in
-- 20260525164500_moves_deposit_capture_columns.sql exist on the table
-- (verified by a direct REST query against the column), but PostgREST
-- did not refresh its in-memory schema cache after the previous push.
-- Result: the admin UI's move-create still fails with:
--   "Could not find the 'deposit_method' column of 'moves' in the schema cache"
--
-- PostgREST listens on the `pgrst` LISTEN channel for the literal
-- payload `reload schema`. NOTIFYing it forces an immediate cache rebuild.
-- This is a no-op migration in terms of schema; its purpose is the side
-- effect. Safe to re-run.

NOTIFY pgrst, 'reload schema';
