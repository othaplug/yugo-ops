-- Inventory expansion: add missing items referenced by the updated inventory-search.ts
-- guard rules, fix misclassified items, expand catalog for lamps, cabinets, art,
-- recliners, fans, and luxury/specialty furniture.

INSERT INTO public.item_weights (
  item_name, slug, weight_score, category, room,
  is_common, display_order, active,
  assembly_complexity, disassembly_required, assembly_notes,
  num_people_min, is_fragile, requires_specialist
)
VALUES

-- ── LAMPS / LIGHTING ──────────────────────────────────────────────────────────

('Table Lamp', 'table-lamp', 0.3, 'light', 'living_room',
 true, 300, true, 'none', false, NULL, 1, false, false),

('Floor Lamp', 'floor-lamp', 0.5, 'light', 'living_room',
 true, 301, true, 'none', false, 'Unplug and disassemble if multi-section.', 1, false, false),

('Pendant Lamp / Hanging Light', 'pendant-lamp', 0.3, 'light', 'living_room',
 false, 302, true, 'simple', true, 'Remove from ceiling fitting. Wrap bulb.', 1, true, false),

-- ── CABINETS ──────────────────────────────────────────────────────────────────

('Kitchen Cabinet', 'cabinet-kitchen', 2.0, 'heavy', 'kitchen',
 true, 400, true, 'complex', true,
 'Wall-mounted units must be uninstalled before moving. Upper cabs: remove all contents. Lower cabs: remove drawers. 2 people.', 2, false, false),

('Bathroom Cabinet / Vanity Cabinet', 'cabinet-bathroom', 1.2, 'medium', 'bathroom',
 true, 401, true, 'moderate', true,
 'Remove from wall if wall-mounted. Empty before moving.', 1, false, false),

('Storage Cabinet / Linen Cabinet', 'cabinet-storage', 1.5, 'medium', 'other',
 true, 402, true, 'simple', true,
 'Empty shelves before moving. May need to disassemble for transport.', 2, false, false),

('China Cabinet / Display Cabinet', 'china-cabinet', 2.5, 'heavy', 'dining',
 false, 403, true, 'simple', true,
 'Remove all items and glass doors before moving. Fragile glass.', 2, true, false),

-- ── ART / PICTURE FRAMES ──────────────────────────────────────────────────────

('Artwork — Framed (Small, under 24")', 'artwork-framed-small', 0.3, 'light', 'other',
 true, 500, true, 'none', false, 'Wrap corners. Use picture boxes.', 1, true, false),

('Artwork — Framed (Medium, 24"–48")', 'artwork-framed-medium', 0.5, 'light', 'other',
 true, 501, true, 'none', false, 'Wrap corners. Use picture boxes.', 1, true, false),

('Artwork — Framed (Large, over 48")', 'artwork-framed-large', 1.0, 'medium', 'other',
 false, 502, true, 'none', false, 'Custom crating recommended. 2 people for large frames.', 2, true, false),

('Sculpture / 3D Artwork', 'artwork-sculpture', 2.0, 'medium', 'other',
 false, 503, true, 'specialist', false,
 'Custom crating required. High value — specialist handling. Document condition.', 2, true, true),

('Painting (Canvas)', 'artwork-painting', 0.5, 'light', 'other',
 false, 504, true, 'none', false, 'Do not stack face-to-face. Glassine between canvases.', 1, true, false),

('Mirror — Small (under 24")', 'mirror-small', 0.5, 'light', 'bedroom',
 true, 505, true, 'none', false, 'Wrap in bubble wrap and mirror boxes.', 1, true, false),

('Mirror — Large (24"+)', 'mirror-large', 1.5, 'medium', 'bedroom',
 true, 506, true, 'none', false, 'Very fragile. 2 people. Mirror box essential.', 2, true, false),

-- ── DINING ROOM ───────────────────────────────────────────────────────────────

('Dining Chair — Standard', 'dining-chair', 0.4, 'light', 'dining',
 true, 600, true, 'none', false, 'Stack up to 4 chairs per carry.', 1, false, false),

('Dining Chair — Upholstered', 'dining-chair-upholstered', 0.5, 'light', 'dining',
 true, 601, true, 'none', false, 'Protect fabric. Do not stack too high.', 1, false, false),

('Bar Stool', 'bar-stool', 0.4, 'light', 'dining',
 true, 602, true, 'none', false, 'Stack if possible.', 1, false, false),

-- ── RECLINERS / SPECIALTY SEATING ─────────────────────────────────────────────

('Recliner Chair — Manual (Lazy Boy style)', 'recliner-manual', 2.0, 'heavy', 'living_room',
 true, 700, true, 'none', false, 'Heavy mechanism. Remove legs if possible. 2 people.', 2, false, false),

('Recliner Chair — Power / Electric', 'recliner-power', 2.5, 'heavy', 'living_room',
 true, 701, true, 'none', false, 'Heavy + power cable. Electronics fragile. 2 people.', 2, true, false),

('Reclining Sofa / Recliner Sofa', 'sectional-recliner', 3.5, 'extra_heavy', 'living_room',
 true, 702, true, 'simple', true,
 'May split into sections. Each section heavy. 3 people. Recline mechanism adds weight.', 3, false, false),

('Sleeper Sofa / Pull-Out Bed', 'sleeper-sofa', 3.5, 'extra_heavy', 'living_room',
 true, 703, true, 'none', false,
 'Very heavy due to pull-out mattress mechanism. 3 people. Cannot tip sideways.', 3, false, false),

-- ── FANS ──────────────────────────────────────────────────────────────────────

('Standing Fan / Tower Fan', 'standing-fan', 0.5, 'light', 'other',
 true, 800, true, 'simple', true, 'Disassemble base for transport. Lightweight.', 1, false, false),

('Ceiling Fan', 'ceiling-fan', 1.0, 'medium', 'other',
 false, 801, true, 'moderate', true,
 'Must be uninstalled from ceiling. Remove blades. Fragile motor housing.', 1, true, false),

-- ── SIDE TABLE (aliased from "side-end-table" guard) ─────────────────────────

('Side Table / End Table', 'side-table', 0.5, 'light', 'living_room',
 true, 210, true, 'none', false, 'Light standalone table. 1 person.', 1, false, false),

-- ── LUXURY / HIGH-VALUE ITEMS ─────────────────────────────────────────────────

('Antique / High-Value Furniture', 'antique-furniture', 2.0, 'heavy', 'other',
 false, 900, true, 'specialist', false,
 'Extra blanket wrapping. Do not disassemble unless known safe. Document before and after.', 2, true, true),

('Wine Refrigerator / Wine Cooler', 'wine-fridge', 2.0, 'medium', 'kitchen',
 false, 901, true, 'none', false,
 'Empty and defrost. Transport upright. 2 people.', 2, false, false),

('Safe — Small (under 300 lbs)', 'safe-small', 5.0, 'extra_heavy', 'other',
 false, 902, true, 'none', false,
 'Very dense. Dolly required. Confirm floor load capacity at destination.', 2, false, false),

('Safe — Large (over 300 lbs)', 'safe-large', 8.0, 'extra_heavy', 'other',
 false, 903, true, 'specialist', false,
 'Specialist equipment required. May need pallet jack.', 3, false, true),

-- ── GYM / FITNESS ─────────────────────────────────────────────────────────────

('Treadmill', 'gym-treadmill', 4.0, 'extra_heavy', 'other',
 true, 1000, true, 'moderate', true,
 'Fold if foldable. Non-folding: very heavy and awkward. 2-3 people.', 3, false, false),

('Elliptical Machine', 'gym-elliptical', 3.5, 'extra_heavy', 'other',
 false, 1001, true, 'moderate', true,
 'Partial disassembly for transport. 2-3 people.', 3, false, false),

('Stationary Bike / Peloton', 'gym-bike', 2.0, 'heavy', 'other',
 true, 1002, true, 'moderate', true,
 'Remove screen if detachable. 2 people. Fragile screen.', 2, true, false),

('Weight Bench', 'gym-bench', 2.0, 'heavy', 'other',
 true, 1003, true, 'moderate', true, 'Remove weights. Disassemble rack.', 2, false, false),

('Free Weights / Dumbbells (Set)', 'gym-weights', 3.0, 'extra_heavy', 'other',
 true, 1004, true, 'none', false,
 'Very dense per box. Pack in small boxes only. Max 30 lbs per box.', 1, false, false),

-- ── OUTDOOR ───────────────────────────────────────────────────────────────────

('Patio Table', 'patio-table', 1.5, 'medium', 'outdoor',
 true, 1100, true, 'simple', true, 'Remove umbrella and legs if possible.', 2, false, false),

('Patio Chair / Lounge Chair', 'patio-chair', 0.5, 'light', 'outdoor',
 true, 1101, true, 'none', false, 'Stack if stackable.', 1, false, false),

('Patio Sofa / Outdoor Sectional', 'patio-sofa', 2.5, 'heavy', 'outdoor',
 false, 1102, true, 'simple', true, 'Splits into sections. Cushions packed separately.', 2, false, false),

('Barbecue / Gas Grill', 'bbq-gas', 3.0, 'heavy', 'outdoor',
 true, 1103, true, 'none', false,
 'Empty propane tank (legally required). Clean grill. 2 people.', 2, false, false),

('Kamado Grill (Big Green Egg, Kamado Joe)', 'bbq-kamado', 5.0, 'extra_heavy', 'outdoor',
 false, 1104, true, 'specialist', false,
 'Extremely heavy ceramic. Cracks if dropped. Custom crate or specialist pads.', 3, true, true),

-- ── OFFICE ────────────────────────────────────────────────────────────────────

('Standing Desk — Electric / Motorized', 'desk-standing-electric', 2.5, 'heavy', 'office',
 true, 1200, true, 'moderate', true,
 'Electric motors in base. Disconnect and protect cables. 30-45 min. 2 people.', 2, false, false),

('Standing Desk — Manual', 'desk-standing-manual', 2.0, 'heavy', 'office',
 true, 1201, true, 'moderate', true,
 'Remove top from base for transport. 30-40 min. 2 people.', 2, false, false),

('L-Shaped Desk', 'desk-l-shape', 2.5, 'heavy', 'office',
 true, 1202, true, 'complex', true,
 'Multiple sections — full disassembly required. 45-60 min. 2 people.', 2, false, false),

('Filing Cabinet — 4 Drawer', 'filing-cabinet-4', 3.0, 'extra_heavy', 'office',
 false, 1203, true, 'none', false,
 'Very heavy when full. Empty first. 2-3 people.', 3, false, false),

-- ── SPECIALTY ─────────────────────────────────────────────────────────────────

('Piano — Upright', 'piano-upright', 8.0, 'extra_heavy', 'other',
 false, 1300, true, 'specialist', true,
 'SPECIALIST REQUIRED. 400-900 lbs. Piano board and straps. 3-4 people. Separate quote.', 4, false, true),

('Piano — Baby Grand', 'piano-baby-grand', 9.0, 'extra_heavy', 'other',
 false, 1301, true, 'specialist', true,
 'SPECIALIST REQUIRED. Legs removed. Wrapped in blankets. Piano board required.', 4, false, true),

('Pool Table — Slate', 'pool-table-slate', 7.0, 'extra_heavy', 'other',
 false, 1302, true, 'specialist', true,
 'SPECIALIST REQUIRED. Slate very heavy and fragile. Full disassembly.', 4, false, true),

('Aquarium — Large (50+ gallons)', 'aquarium-large', 5.0, 'extra_heavy', 'other',
 false, 1303, true, 'specialist', false,
 'Drain fully. Extremely fragile at this size. 3 people.', 3, true, true),

('Aquarium — Small (under 50 gallons)', 'aquarium-small', 3.0, 'heavy', 'other',
 false, 1304, true, 'complex', false,
 'Drain fully. Very fragile glass. Transport empty.', 2, true, false),

('Motorcycle', 'motorcycle', 6.0, 'extra_heavy', 'other',
 false, 1305, true, 'specialist', false,
 'Requires wheel chocks and tie-down straps. Drain fuel if required by building.', 2, false, true)

ON CONFLICT (slug) DO UPDATE SET
  item_name           = EXCLUDED.item_name,
  weight_score        = EXCLUDED.weight_score,
  category            = EXCLUDED.category,
  room                = EXCLUDED.room,
  is_common           = EXCLUDED.is_common,
  display_order       = EXCLUDED.display_order,
  active              = EXCLUDED.active,
  assembly_complexity = EXCLUDED.assembly_complexity,
  disassembly_required = EXCLUDED.disassembly_required,
  assembly_notes      = EXCLUDED.assembly_notes,
  num_people_min      = EXCLUDED.num_people_min,
  is_fragile          = EXCLUDED.is_fragile,
  requires_specialist = EXCLUDED.requires_specialist;

-- Fix the side-end-table slug that old guard rules referenced
INSERT INTO public.item_weights (item_name, slug, weight_score, category, room, is_common, display_order, active)
VALUES ('Side Table / End Table', 'side-end-table', 0.5, 'light', 'living_room', true, 211, true)
ON CONFLICT (slug) DO NOTHING;
