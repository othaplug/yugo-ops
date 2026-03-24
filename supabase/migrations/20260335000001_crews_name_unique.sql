-- ═══════════════════════════════════════════════════════════════
-- Add UNIQUE constraint on crews.name to prevent duplicate teams
-- ═══════════════════════════════════════════════════════════════
--
-- First, deduplicate any existing rows with identical names by
-- appending a numeric suffix to the later-created duplicates.
--
-- Add created_at if it is missing (may have been dropped by a prior schema change).
ALTER TABLE crews ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

WITH dupes AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id ASC) AS rn
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
