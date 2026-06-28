-- Building profiles: allow 'other' on access_archetype.
--
-- The crew-side Building Report card (src/components/crew/
-- CrewBuildingReportCard.tsx) presents five archetypes:
--   house · walk_up · elevator · two_stage · other
--
-- But the original check constraint (migration 20260621120000) only
-- allowed the first four. When crew tapped "Other" the insert failed
-- with `building_profiles_access_archetype_check` and the raw Postgres
-- error bubbled to the screen — crew couldn't save the building report,
-- blocking the move-completion checklist on jobs where none of the four
-- preset archetypes fit (warehouses, storage facilities, mixed-use
-- properties, etc.).
--
-- 2026-06-28 Oche flagged the live crew-app error screenshot. Same-day
-- fix.

ALTER TABLE public.building_profiles
  DROP CONSTRAINT IF EXISTS building_profiles_access_archetype_check;

ALTER TABLE public.building_profiles
  ADD CONSTRAINT building_profiles_access_archetype_check
    CHECK (access_archetype IN ('house', 'walk_up', 'elevator', 'two_stage', 'other'));
