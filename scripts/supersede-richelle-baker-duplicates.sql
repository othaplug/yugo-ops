-- One-time data fix: mark older Richelle Baker draft duplicates as superseded.
-- Keeps the MOST RECENT draft (highest created_at) as the active one;
-- marks all older drafts as superseded, pointing to the most recent.

WITH baker_quotes AS (
  SELECT
    q.id,
    q.quote_id,
    q.created_at,
    q.status,
    ROW_NUMBER() OVER (ORDER BY q.created_at DESC) AS rn
  FROM public.quotes q
  JOIN public.contacts c ON c.id = q.contact_id
  WHERE
    c.name ILIKE '%richelle baker%'
    AND q.status = 'draft'
),
latest AS (
  SELECT id, quote_id FROM baker_quotes WHERE rn = 1
)
UPDATE public.quotes q
SET
  status        = 'superseded',
  superseded_by = latest.id,
  superseded_at = now(),
  updated_at    = now()
FROM baker_quotes old, latest
WHERE
  q.id = old.id
  AND old.rn > 1
  AND latest.id IS NOT NULL;

-- Verify: show all Richelle Baker quotes after the fix
SELECT q.quote_id, q.status, q.created_at, q.superseded_by
FROM public.quotes q
JOIN public.contacts c ON c.id = q.contact_id
WHERE c.name ILIKE '%richelle baker%'
ORDER BY q.created_at DESC;
