-- Fix inventory rooms and white glove item transfer.
--
-- Two issues addressed:
--
-- 1. White glove moves (service_type = 'white_glove') store their items in
--    moves.items (copied from factors_applied.white_glove_items), not in
--    inventory_items.  The 20260511120000 migration only looked at
--    inventory_items, so white glove moves were never backfilled.
--
-- 2. Residential move_inventory rows created by 20260511120000 all landed as
--    room = 'Other' because inventory_items JSONB has no room field.  The
--    item_weights catalog DOES have room data per slug, so we can join back
--    to get the correct room.

-- ── 1. Backfill white glove moves from moves.items ────────────────────────────
INSERT INTO public.move_inventory (move_id, room, item_name, box_number, sort_order)
SELECT
  m.id                                                         AS move_id,
  'Delivery Items'                                             AS room,
  trim(item->>'description')                                   AS item_name,
  NULL                                                         AS box_number,
  (ordinality - 1)::integer                                   AS sort_order
FROM
  public.moves m,
  jsonb_array_elements(m.items) WITH ORDINALITY AS t(item, ordinality)
WHERE
  m.service_type IN ('white_glove', 'single_item', 'b2b_delivery', 'b2b_oneoff', 'b2b_one_off')
  AND jsonb_array_length(m.items) > 0
  AND (item->>'description') IS NOT NULL
  AND trim(item->>'description') <> ''
  -- Only for moves with no existing move_inventory rows
  AND NOT EXISTS (
    SELECT 1 FROM public.move_inventory mi WHERE mi.move_id = m.id
  );

-- ── 2. Update "Other" rooms using slug → item_weights.room lookup ─────────────
-- Normalize the item_weights room slugs to display names.
-- Matches on exact name OR name-with-quantity-suffix ("Chair x4").
UPDATE public.move_inventory mi
SET room = CASE iw.room
    WHEN 'bedroom'     THEN 'Bedroom'
    WHEN 'living_room' THEN 'Living Room'
    WHEN 'kitchen'     THEN 'Kitchen'
    WHEN 'dining'      THEN 'Dining Room'
    WHEN 'dining_room' THEN 'Dining Room'
    WHEN 'garage'      THEN 'Garage'
    WHEN 'kids'        THEN 'Kids Room'
    WHEN 'bathroom'    THEN 'Bathroom'
    WHEN 'outdoor'     THEN 'Outdoor'
    WHEN 'office'      THEN 'Office'
    WHEN 'specialty'   THEN 'Specialty'
    ELSE mi.room
  END
FROM public.moves m
JOIN jsonb_array_elements(m.inventory_items) inv ON true
JOIN public.item_weights iw ON iw.slug = inv->>'slug'
WHERE mi.move_id = m.id
  AND mi.room = 'Other'
  AND iw.room NOT IN ('other', '')
  AND iw.room IS NOT NULL
  -- match item name (strip any trailing " xN" quantity suffix for comparison)
  AND regexp_replace(mi.item_name, '\s+x\d+$', '', 'i') = trim(inv->>'name');
