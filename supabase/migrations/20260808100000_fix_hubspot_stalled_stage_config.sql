-- Fix HubSpot cold/stalled stage config.
--
-- platform_config.hubspot_stage_stalled was set to '1314108492' — the
-- SAME stage ID as hubspot_stage_contacted. So every quote marked
-- "cold" in Ops (mapped: cold → stalled → 1314108492 → "Contacted
-- (OPS+)") appeared identical to a brand-new Contacted lead on the
-- HubSpot board. Operator screenshot showed Liza Chernokov (Ops
-- status: cold) sitting in "Contacted (OPS+)" — same visual bucket
-- as untouched new leads.
--
-- Cold quotes are effectively lost (client stopped responding after
-- some period). Point stalled at the closed_lost stage so cold
-- quotes leave active pipelines cleanly. If we later add a real
-- "Cold / Stalled" HubSpot stage the operator can update this
-- config value; the code path doesn't care.
--
-- Backfill: re-push every existing cold quote's stage right after
-- so the visual repair happens immediately (drift cron only touches
-- expired/lost/completed today, not cold — see the code change in
-- this same commit for the follow-up fix).

UPDATE public.platform_config
SET value = '1314108497'
WHERE key = 'hubspot_stage_stalled';
