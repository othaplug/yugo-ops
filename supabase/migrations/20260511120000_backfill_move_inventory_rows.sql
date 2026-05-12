-- Backfill move_inventory rows from moves.inventory_items JSONB snapshot.
--
-- Context: the 20260511110000 migration copied inventory_items from quotes onto
-- moves, but did NOT create the normalized move_inventory rows that the admin UI
-- reads and writes.  If a coordinator adds one item via POST /inventory, the
-- move_inventory table gets 1 row, the fallback stops triggering, and the full
-- prior inventory disappears.
--
-- This migration inserts one move_inventory row per item for every move that:
--   a) has inventory_items JSONB with at least one element, AND
--   b) has no existing rows in move_inventory (avoids duplication).

INSERT INTO public.move_inventory (move_id, room, item_name, box_number, sort_order)
SELECT
  m.id                                                                    AS move_id,
  CASE
    WHEN (item->>'room') IS NOT NULL AND trim(item->>'room') <> ''
    THEN initcap(replace(trim(item->>'room'), '_', ' '))
    ELSE 'Other'
  END                                                                     AS room,
  CASE
    WHEN (item->>'quantity')::int > 1
    THEN concat(trim(item->>'name'), ' x', (item->>'quantity')::int)
    ELSE trim(item->>'name')
  END                                                                     AS item_name,
  NULL                                                                    AS box_number,
  idx                                                                     AS sort_order
FROM
  public.moves m,
  jsonb_array_elements(m.inventory_items) WITH ORDINALITY AS t(item, idx)
WHERE
  -- Only moves that have the JSONB snapshot
  jsonb_array_length(m.inventory_items) > 0
  -- Item must have a non-empty name
  AND (item->>'name') IS NOT NULL
  AND trim(item->>'name') <> ''
  -- Skip moves that already have move_inventory rows (don't duplicate)
  AND NOT EXISTS (
    SELECT 1 FROM public.move_inventory mi WHERE mi.move_id = m.id
  );
