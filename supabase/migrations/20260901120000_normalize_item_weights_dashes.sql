-- Brand rule: NO em dashes (—) or en dashes (–) in the app, including inventory
-- item names. The item_weights seed migrations inserted names like
-- 'Mattress — Queen' and 'TV Stand / Entertainment Unit — Large (55"+)'. This
-- normalizes them so a fresh database (db:push) starts clean, matching the
-- runtime sanitizer in src/lib/text/dedash.ts (cleanItemName):
--   * a numeric size range (e.g. 55–65") becomes a hyphen (55-65")
--   * every other em/en dash separator becomes a comma
-- Idempotent: only touches rows that still contain a dash.
UPDATE item_weights
SET item_name = btrim(
  regexp_replace(
    regexp_replace(
      regexp_replace(item_name, '([0-9])\s*[—–]\s*([0-9])', '\1-\2', 'g'),
      '\s*[—–]\s*', ', ', 'g'
    ),
    '\s{2,}', ' ', 'g'
  )
)
WHERE item_name ~ '[—–]';
