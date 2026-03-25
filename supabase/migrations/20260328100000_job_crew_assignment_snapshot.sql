-- Persist crew roster + display name on each job so history survives team edits/deletes.

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS assigned_members JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_crew_name TEXT;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS assigned_crew_name TEXT;

COMMENT ON COLUMN public.deliveries.assigned_members IS 'Names on the crew at assignment time; preserved if crew roster or team row changes.';
COMMENT ON COLUMN public.deliveries.assigned_crew_name IS 'Crew/team display name at assignment time.';
COMMENT ON COLUMN public.moves.assigned_crew_name IS 'Crew/team display name at assignment time (roster is assigned_members).';

-- Backfill from live crew rows where still linked
UPDATE public.deliveries d
SET
  assigned_members = COALESCE(
    NULLIF(d.assigned_members, 'null'::jsonb),
    to_jsonb(COALESCE(c.members, ARRAY[]::text[]))
  ),
  assigned_crew_name = COALESCE(NULLIF(TRIM(d.assigned_crew_name), ''), c.name)
FROM public.crews c
WHERE d.crew_id = c.id
  AND (
    d.assigned_members IS NULL
    OR d.assigned_members = '[]'::jsonb
    OR d.assigned_members = 'null'::jsonb
    OR d.assigned_crew_name IS NULL
    OR TRIM(d.assigned_crew_name) = ''
  );

UPDATE public.deliveries d
SET assigned_crew_name = c.name
FROM public.crews c
WHERE d.crew_id = c.id
  AND (d.assigned_crew_name IS NULL OR TRIM(d.assigned_crew_name) = '');

UPDATE public.moves m
SET assigned_crew_name = c.name
FROM public.crews c
WHERE m.crew_id = c.id
  AND (m.assigned_crew_name IS NULL OR TRIM(m.assigned_crew_name) = '');
