-- Assembly complexity backfill for the "generic" furniture catalog rows.
--
-- Context: On YG-30281 the operator picked Assembly=Required and added
-- "Bed Frame + Mattress (Queen)" + "Dresser (small)" + "Desk
-- (large/heavy)" to the inventory. detectAssemblyRequired() then
-- reported "No assembly items detected in inventory" and the send
-- guard refused to ship. Operator was correct — bed frames obviously
-- need disassembly + reassembly.
--
-- Root cause: item_weights had TWO parallel sets of furniture rows:
--   1. Generic slugs (queen-bed-frame, dresser-large, desk-small,
--      wardrobe, dining-table, bookcase-office, etc.) all with
--      assembly_complexity='none' and disassembly_required=false.
--   2. Specific variant slugs (bed-frame-basic-queen, desk-l-shape,
--      desk-standing-electric, bed-frame-platform-queen, etc.)
--      correctly tagged with simple/moderate/complex.
--
-- The InventoryInput defaults the user to the generic rows, so every
-- quote that picks a bed via the default flow hits the wrong tag.
-- Backfilled with sane defaults — operators with specialty variants
-- (storage beds, L-shape desks, slate pool tables) still have the
-- specific rows available and those keep their correct higher tier.
--
-- Idempotent: re-running on rows already updated is a no-op.

-- Beds (frame + mattress combos) and standalone frames — bed frames
-- across the board need disassembly + reassembly. Bunk beds are more
-- involved (rails, ladder) so moderate.
UPDATE item_weights SET assembly_complexity='simple',   disassembly_required=true  WHERE slug IN ('bed-queen','bed-king','bed-double','bed-single','queen-bed-frame','king-bed-frame','double-bed-frame','single-twin-bed-frame');
UPDATE item_weights SET assembly_complexity='moderate', disassembly_required=true  WHERE slug = 'bunk-bed';
UPDATE item_weights SET assembly_complexity='simple',   disassembly_required=true  WHERE slug = 'crib';

-- Wardrobes / armoires — almost always disassembled for moves
-- (won't fit doorways otherwise).
UPDATE item_weights SET assembly_complexity='simple',   disassembly_required=true  WHERE slug IN ('wardrobe','wardrobe-armoire');

-- Desks — generic desks need at minimum legs off + top wrapped.
-- Standing desks (motorized) are moderate.
UPDATE item_weights SET assembly_complexity='simple',   disassembly_required=true  WHERE slug IN ('desk-small','desk-large','office-desk-large','office-desk-small','kids-desk');
UPDATE item_weights SET assembly_complexity='moderate', disassembly_required=true  WHERE slug = 'standing-desk';

-- Bookcases — typically shelves come out, sides come off.
UPDATE item_weights SET assembly_complexity='simple',   disassembly_required=true  WHERE slug = 'bookcase-office';

-- Generic dining tables — legs off + top wrapped. 6-seater is
-- moderate (heavier top, more leaves).
UPDATE item_weights SET assembly_complexity='simple',   disassembly_required=true  WHERE slug IN ('dining-table','dining-table-4-seater');
UPDATE item_weights SET assembly_complexity='moderate', disassembly_required=true  WHERE slug = 'dining-table-6-seater';

-- Vanity / changing table — legs / drawers / mirror.
UPDATE item_weights SET assembly_complexity='simple',   disassembly_required=true  WHERE slug IN ('vanity-makeup-table','changing-table');

-- Dressers DELIBERATELY untouched — generic dressers ship intact
-- (drawers removed for weight, but no reassembly). If an operator
-- has a true flat-pack IKEA dresser they should pick the custom-
-- variant flow.
