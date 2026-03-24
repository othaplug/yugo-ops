-- ═══════════════════════════════════════════════════════════════
-- Add UNIQUE constraint on crews.name to prevent duplicate teams
-- ═══════════════════════════════════════════════════════════════
--
-- First, deduplicate any existing rows with identical names by
-- appending a numeric suffix to the later-created duplicates.
--
WITH dupes AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) AS rn
  FROM crews
)
UPDATE crews c
SET name = c.name || ' (' || d.rn::text || ')'
FROM dupes d
WHERE c.id = d.id
  AND d.rn > 1;

-- Now it is safe to add the unique constraint.
ALTER TABLE crews
  ADD CONSTRAINT crews_name_unique UNIQUE (name);
