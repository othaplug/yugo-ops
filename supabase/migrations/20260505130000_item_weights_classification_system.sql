-- Inventory taxonomy: operational metadata columns, search indexes, catalog corrections (global paste / quotes / moves).

ALTER TABLE public.item_weights
  ADD COLUMN IF NOT EXISTS assembly_complexity TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS disassembly_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS assembly_notes TEXT,
  ADD COLUMN IF NOT EXISTS num_people_min INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_specialist BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.item_weights.assembly_complexity IS 'none | simple | moderate | complex | specialist';

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_item_weights_item_name_trgm ON public.item_weights USING gin (item_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_item_weights_slug_trgm ON public.item_weights USING gin (slug gin_trgm_ops);

-- Canonical slug upserts (matches application matchers). Category stays aligned with volume scoring (heavy/medium/light/very_light/extra_heavy/electronics/appliance/furniture/decor/other).

INSERT INTO public.item_weights (
  item_name,
  slug,
  weight_score,
  category,
  room,
  is_common,
  display_order,
  active,
  assembly_complexity,
  disassembly_required,
  assembly_notes,
  num_people_min,
  is_fragile,
  requires_specialist
)
VALUES
  ('Pillows (Set)', 'pillows-set', 0.1, 'very_light', 'bedroom', true, 113, true, 'none', false, NULL, 1, false, false),
  ('Duvet / Comforter', 'duvet', 0.2, 'very_light', 'bedroom', false, 114, true, 'none', false, NULL, 1, false, false),
  ('Sheet Set', 'sheet-set', 0.1, 'very_light', 'bedroom', true, 115, true, 'none', false, NULL, 1, false, false),
  ('Bedding Bundle (Pillows, Duvet, Sheets)', 'bedding-bundle', 0.3, 'very_light', 'bedroom', true, 116, true, 'none', false, NULL, 1, false, false),
  ('Mattress Protector / Topper', 'mattress-protector', 0.2, 'very_light', 'bedroom', false, 117, true, 'none', false, NULL, 1, false, false),
  ('Sound bar', 'soundbar', 0.3, 'electronics', 'living_room', true, 218, true, 'none', false, NULL, 1, true, false),
  ('Sound bar with Wireless Subwoofer', 'soundbar-subwoofer', 0.5, 'electronics', 'living_room', true, 219, true, 'none', false, NULL, 1, true, false),
  ('Subwoofer (standalone)', 'subwoofer', 1.0, 'electronics', 'living_room', false, 220, true, 'none', false, NULL, 1, true, false),
  ('Television — Medium (43"–55")', 'tv-medium', 0.8, 'electronics', 'living_room', true, 221, true, 'none', false, NULL, 2, true, false),
  ('Television — Extra Large (75"+)', 'tv-xl', 1.5, 'electronics', 'living_room', true, 222, true, 'none', false, NULL, 3, true, false),
  ('Adjustable Base — Power (Twin XL)', 'adjustable-base-twin-xl', 2.0, 'heavy', 'bedroom', false, 118, true, 'moderate', true, NULL, 2, true, false),
  ('Adjustable Base — Power (Queen)', 'adjustable-base-queen', 2.8, 'heavy', 'bedroom', true, 119, true, 'moderate', true, NULL, 2, true, false),
  ('Adjustable Base — Power (King / Split King)', 'adjustable-base-king', 3.5, 'extra_heavy', 'bedroom', true, 120, true, 'complex', true, NULL, 2, true, false),
  ('Bed Frame — Basic (Twin)', 'bed-frame-basic-twin', 0.8, 'medium', 'bedroom', false, 121, true, 'simple', true, NULL, 1, false, false),
  ('Bed Frame — Basic (Double/Full)', 'bed-frame-basic-double', 0.9, 'heavy', 'bedroom', false, 122, true, 'simple', true, NULL, 1, false, false),
  ('Bed Frame — Basic (Queen)', 'bed-frame-basic-queen', 1.0, 'heavy', 'bedroom', true, 123, true, 'simple', true, NULL, 1, false, false),
  ('Bed Frame — Basic (King)', 'bed-frame-basic-king', 1.2, 'heavy', 'bedroom', true, 124, true, 'simple', true, NULL, 2, false, false),
  ('Bed Frame — Platform (Queen)', 'bed-frame-platform-queen', 1.5, 'heavy', 'bedroom', true, 125, true, 'moderate', true, NULL, 2, false, false),
  ('Bed Frame — Platform (King)', 'bed-frame-platform-king', 1.8, 'heavy', 'bedroom', true, 126, true, 'moderate', true, NULL, 2, false, false),
  ('Bed Frame — Storage / Lift (Queen)', 'bed-frame-storage-queen', 2.5, 'extra_heavy', 'bedroom', false, 127, true, 'complex', true, NULL, 2, false, false),
  ('Bed Frame — Storage / Lift (King)', 'bed-frame-storage-king', 3.0, 'extra_heavy', 'bedroom', false, 128, true, 'complex', true, NULL, 2, false, false),
  ('Nightstand — Flat Pack', 'nightstand-flatpack', 0.5, 'light', 'bedroom', false, 132, true, 'simple', true, NULL, 1, false, false),
  ('TV Stand / Entertainment Unit — Small (under 55")', 'tv-stand-small', 1.0, 'heavy', 'living_room', true, 223, true, 'simple', true, NULL, 1, false, false),
  ('TV Stand / Entertainment Unit — Large (55"+)', 'tv-stand-large', 1.8, 'heavy', 'living_room', true, 224, true, 'moderate', true, NULL, 2, false, false),
  ('Dining Table — Small (seats 4)', 'dining-table-small', 1.5, 'heavy', 'dining_room', false, 308, true, 'simple', true, NULL, 2, false, false),
  ('Dining Table — Medium (seats 6)', 'dining-table-medium', 2.5, 'heavy', 'dining_room', true, 309, true, 'moderate', true, NULL, 2, false, false),
  ('Dining Table — Large (seats 8+)', 'dining-table-large', 3.5, 'extra_heavy', 'dining_room', false, 310, true, 'moderate', true, NULL, 3, false, false),
  ('Coffee Table — Glass Top', 'coffee-table-glass', 1.2, 'medium', 'living_room', false, 225, true, 'none', false, NULL, 2, true, false),
  ('Desk — Standing / Height Adjustable (Electric)', 'desk-standing-electric', 2.5, 'heavy', 'office', false, 508, true, 'moderate', true, NULL, 2, false, false),
  ('Printer — Desktop', 'printer-desktop', 0.8, 'electronics', 'office', true, 509, true, 'none', false, NULL, 1, true, false),
  ('Moving Box — Medium', 'box-medium', 0.5, 'light', 'other', true, 1010, true, 'none', false, NULL, 1, false, false),
  ('Moving Box — Large', 'box-large', 0.8, 'medium', 'other', true, 1011, true, 'none', false, NULL, 1, false, false)
ON CONFLICT (slug) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  weight_score = EXCLUDED.weight_score,
  category = EXCLUDED.category,
  room = COALESCE(EXCLUDED.room, public.item_weights.room),
  is_common = EXCLUDED.is_common,
  display_order = EXCLUDED.display_order,
  active = EXCLUDED.active,
  assembly_complexity = COALESCE(EXCLUDED.assembly_complexity, public.item_weights.assembly_complexity),
  disassembly_required = COALESCE(EXCLUDED.disassembly_required, public.item_weights.disassembly_required),
  assembly_notes = COALESCE(EXCLUDED.assembly_notes, public.item_weights.assembly_notes),
  num_people_min = COALESCE(EXCLUDED.num_people_min, public.item_weights.num_people_min),
  is_fragile = COALESCE(EXCLUDED.is_fragile, public.item_weights.is_fragile),
  requires_specialist = COALESCE(EXCLUDED.requires_specialist, public.item_weights.requires_specialist);

UPDATE public.item_weights
SET
  item_name = 'Mattress — Twin',
  category = 'heavy',
  room = COALESCE(room, 'bedroom'),
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 1),
  assembly_complexity = COALESCE(assembly_complexity, 'none')
WHERE slug = 'single-mattress';

UPDATE public.item_weights
SET
  item_name = 'Mattress — Double / Full',
  category = 'heavy',
  room = COALESCE(room, 'bedroom'),
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 2),
  assembly_complexity = COALESCE(assembly_complexity, 'none')
WHERE slug = 'double-mattress';

UPDATE public.item_weights
SET
  item_name = 'Mattress — Queen',
  category = 'heavy',
  room = COALESCE(room, 'bedroom'),
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 2),
  assembly_complexity = COALESCE(assembly_complexity, 'none')
WHERE slug = 'queen-mattress';

UPDATE public.item_weights
SET
  item_name = 'Mattress — King',
  category = 'heavy',
  room = COALESCE(room, 'bedroom'),
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 2),
  assembly_complexity = COALESCE(assembly_complexity, 'none')
WHERE slug = 'king-mattress';

UPDATE public.item_weights
SET
  item_name = 'Safe — Under 300 lbs',
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 2),
  requires_specialist = COALESCE(requires_specialist, FALSE),
  assembly_complexity = COALESCE(assembly_complexity, 'none')
WHERE slug = 'safe-light';

UPDATE public.item_weights
SET
  item_name = 'Safe — Over 300 lbs',
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 3),
  requires_specialist = TRUE,
  assembly_complexity = COALESCE(assembly_complexity, 'specialist')
WHERE slug = 'safe-heavy';

-- Align legacy television rows used by matchers (keep slugs stable).
UPDATE public.item_weights
SET
  item_name = 'Television — Small (under 43")',
  category = 'electronics',
  room = COALESCE(room, 'living_room'),
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 1),
  is_fragile = TRUE,
  assembly_complexity = COALESCE(assembly_complexity, 'none')
WHERE slug = 'tv-small';

UPDATE public.item_weights
SET
  item_name = 'Television — Large (55"–75")',
  category = 'electronics',
  room = COALESCE(room, 'living_room'),
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 2),
  is_fragile = TRUE,
  assembly_complexity = COALESCE(assembly_complexity, 'none')
WHERE slug = 'tv-large';

UPDATE public.item_weights
SET
  item_name = 'Television — Large (65"+)',
  category = 'electronics',
  room = COALESCE(room, 'living_room'),
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 2),
  is_fragile = TRUE,
  assembly_complexity = COALESCE(assembly_complexity, 'none')
WHERE slug = 'tv-large-65';

UPDATE public.item_weights
SET
  item_name = 'Television — Flat / Mounted Panel',
  category = 'electronics',
  room = COALESCE(room, 'living_room'),
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 2),
  is_fragile = TRUE
WHERE slug = 'tv-mounted-flat';

UPDATE public.item_weights
SET
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 1),
  assembly_complexity = COALESCE(assembly_complexity, 'none')
WHERE slug = 'nightstand';

UPDATE public.item_weights
SET
  category = 'electronics',
  room = COALESCE(room, 'living_room'),
  num_people_min = GREATEST(COALESCE(num_people_min, 1), 2),
  is_fragile = TRUE,
  assembly_complexity = COALESCE(assembly_complexity, 'simple')
WHERE slug IN ('tv-stand', 'tv-stand-entertainment-centre');
