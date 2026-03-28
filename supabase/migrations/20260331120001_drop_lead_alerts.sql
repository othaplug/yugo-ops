-- Single lead system: public.leads only. Remove legacy table if it still exists.
-- If you ever had important rows in lead_alerts, restore/backfill before applying
-- this migration in production (this repo never defined that table).

DROP TABLE IF EXISTS public.lead_alerts CASCADE;
