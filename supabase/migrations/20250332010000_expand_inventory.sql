-- ══════════════════════════════════════════════════
-- Expand item_weights: add room, seed 85 items
-- ══════════════════════════════════════════════════

-- Add room column
ALTER TABLE public.item_weights ADD COLUMN IF NOT EXISTS room TEXT DEFAULT 'other';

-- Seed 85 items with room categories (ON CONFLICT slug updates existing)
-- Generate slug from item_name: lower, replace non-alphanumeric with hyphen
INSERT INTO public.item_weights (item_name, slug, weight_score, category, room, is_common, display_order)
VALUES
-- ======= BEDROOM (15 items) =======
('King Bed Frame', 'king-bed-frame', 2.0, 'heavy', 'bedroom', true, 100),
('Queen Bed Frame', 'queen-bed-frame', 2.0, 'heavy', 'bedroom', true, 101),
('Double Bed Frame', 'double-bed-frame', 1.5, 'heavy', 'bedroom', true, 102),
('Single/Twin Bed Frame', 'single-twin-bed-frame', 1.0, 'medium', 'bedroom', true, 103),
('Bunk Bed', 'bunk-bed', 2.5, 'heavy', 'bedroom', false, 104),
('King Mattress', 'king-mattress', 2.0, 'heavy', 'bedroom', true, 105),
('Queen Mattress', 'queen-mattress', 1.5, 'heavy', 'bedroom', true, 106),
('Double Mattress', 'double-mattress', 1.5, 'heavy', 'bedroom', false, 107),
('Single Mattress', 'single-mattress', 1.0, 'medium', 'bedroom', false, 108),
('Dresser (large)', 'dresser-large', 2.0, 'heavy', 'bedroom', true, 109),
('Dresser (small)', 'dresser-small', 1.0, 'medium', 'bedroom', false, 110),
('Nightstand', 'nightstand', 0.5, 'light', 'bedroom', true, 111),
('Wardrobe/Armoire', 'wardrobe-armoire', 2.5, 'heavy', 'bedroom', false, 112),
('Vanity/Makeup Table', 'vanity-makeup-table', 1.0, 'medium', 'bedroom', false, 113),
('Chest of Drawers', 'chest-of-drawers', 1.5, 'heavy', 'bedroom', false, 114),
-- ======= LIVING ROOM (18 items) =======
('Sofa (3-seater)', 'sofa-3-seater', 2.0, 'heavy', 'living_room', true, 200),
('Sofa (2-seater/Loveseat)', 'sofa-2-seater-loveseat', 1.5, 'heavy', 'living_room', true, 201),
('Sectional Sofa', 'sectional-sofa', 3.0, 'extra_heavy', 'living_room', true, 202),
('Armchair/Accent Chair', 'armchair-accent-chair', 1.0, 'medium', 'living_room', true, 203),
('Recliner', 'recliner', 1.5, 'heavy', 'living_room', false, 204),
('Coffee Table', 'coffee-table', 1.0, 'medium', 'living_room', true, 205),
('Side/End Table', 'side-end-table', 0.5, 'light', 'living_room', true, 206),
('Console Table', 'console-table', 1.0, 'medium', 'living_room', false, 207),
('TV Stand/Entertainment Centre', 'tv-stand-entertainment-centre', 1.5, 'heavy', 'living_room', true, 208),
('Bookshelf (large)', 'bookshelf-large', 2.0, 'heavy', 'living_room', true, 209),
('Bookshelf (small)', 'bookshelf-small', 1.0, 'medium', 'living_room', false, 210),
('TV (mounted/flat)', 'tv-mounted-flat', 0.5, 'light', 'living_room', true, 211),
('TV (large 65"+)', 'tv-large-65', 1.0, 'medium', 'living_room', false, 212),
('Floor Lamp', 'floor-lamp', 0.3, 'very_light', 'living_room', true, 213),
('Table Lamp', 'table-lamp', 0.3, 'very_light', 'living_room', false, 214),
('Ottoman/Footstool', 'ottoman-footstool', 0.5, 'light', 'living_room', false, 215),
('Display Cabinet/Curio', 'display-cabinet-curio', 2.0, 'heavy', 'living_room', false, 216),
('Fireplace Mantle/Electric Fireplace', 'fireplace-mantle-electric-fireplace', 1.5, 'heavy', 'living_room', false, 217),
-- ======= DINING ROOM (8 items) =======
('Dining Table (6+ seater)', 'dining-table-6-seater', 2.0, 'heavy', 'dining_room', true, 300),
('Dining Table (4 seater)', 'dining-table-4-seater', 1.5, 'heavy', 'dining_room', true, 301),
('Dining Chair', 'dining-chair', 0.5, 'light', 'dining_room', true, 302),
('China Cabinet/Hutch', 'china-cabinet-hutch', 2.5, 'heavy', 'dining_room', false, 303),
('Buffet/Sideboard', 'buffet-sideboard', 2.0, 'heavy', 'dining_room', false, 304),
('Bar Cart', 'bar-cart', 0.5, 'light', 'dining_room', false, 305),
('Wine Rack/Cabinet', 'wine-rack-cabinet', 1.0, 'medium', 'dining_room', false, 306),
('Bench (dining)', 'bench-dining', 1.0, 'medium', 'dining_room', false, 307),
-- ======= KITCHEN (8 items) =======
('Refrigerator', 'refrigerator', 3.0, 'extra_heavy', 'kitchen', true, 400),
('Stove/Range', 'stove-range', 2.5, 'extra_heavy', 'kitchen', true, 401),
('Dishwasher', 'dishwasher', 2.0, 'heavy', 'kitchen', false, 402),
('Microwave', 'microwave', 0.5, 'light', 'kitchen', true, 403),
('Kitchen Island/Cart', 'kitchen-island-cart', 1.5, 'heavy', 'kitchen', false, 404),
('Washer', 'washer', 2.5, 'extra_heavy', 'kitchen', true, 405),
('Dryer', 'dryer', 2.5, 'extra_heavy', 'kitchen', true, 406),
('Freezer (standalone)', 'freezer-standalone', 2.5, 'extra_heavy', 'kitchen', false, 407),
-- ======= OFFICE / STUDY (8 items) =======
('Office Desk (large)', 'office-desk-large', 2.0, 'heavy', 'office', true, 500),
('Office Desk (small)', 'office-desk-small', 1.0, 'medium', 'office', true, 501),
('Office Chair', 'office-chair', 0.5, 'light', 'office', true, 502),
('Filing Cabinet', 'filing-cabinet', 1.5, 'heavy', 'office', false, 503),
('Computer Monitor', 'computer-monitor', 0.5, 'light', 'office', true, 504),
('Printer/Scanner', 'printer-scanner', 0.5, 'light', 'office', false, 505),
('Standing Desk', 'standing-desk', 2.0, 'heavy', 'office', false, 506),
('Bookcase (office)', 'bookcase-office', 1.5, 'heavy', 'office', false, 507),
-- ======= OUTDOOR / PATIO (8 items) =======
('Patio Table', 'patio-table', 1.5, 'heavy', 'outdoor', false, 600),
('Patio Chair', 'patio-chair', 0.5, 'light', 'outdoor', false, 601),
('Patio Set (table + chairs)', 'patio-set-table-chairs', 2.5, 'heavy', 'outdoor', true, 602),
('BBQ/Grill', 'bbq-grill', 2.0, 'heavy', 'outdoor', false, 603),
('Patio Umbrella', 'patio-umbrella', 0.5, 'light', 'outdoor', false, 604),
('Outdoor Bench', 'outdoor-bench', 1.0, 'medium', 'outdoor', false, 605),
('Planter (large)', 'planter-large', 1.0, 'medium', 'outdoor', false, 606),
('Outdoor Storage Box', 'outdoor-storage-box', 1.0, 'medium', 'outdoor', false, 607),
-- ======= KIDS / NURSERY (6 items) =======
('Crib', 'crib', 1.5, 'heavy', 'kids', true, 700),
('Changing Table', 'changing-table', 1.0, 'medium', 'kids', false, 701),
('High Chair', 'high-chair', 0.5, 'light', 'kids', false, 702),
('Kids Desk', 'kids-desk', 0.5, 'light', 'kids', false, 703),
('Toy Chest/Storage', 'toy-chest-storage', 1.0, 'medium', 'kids', false, 704),
('Rocking Chair/Glider', 'rocking-chair-glider', 1.0, 'medium', 'kids', false, 705),
-- ======= STORAGE / GARAGE (6 items) =======
('Shelving Unit (metal)', 'shelving-unit-metal', 1.5, 'heavy', 'garage', false, 800),
('Workbench', 'workbench', 2.0, 'heavy', 'garage', false, 801),
('Tool Chest/Cabinet', 'tool-chest-cabinet', 2.0, 'heavy', 'garage', false, 802),
('Bicycle', 'bicycle', 0.5, 'light', 'garage', false, 803),
('Treadmill', 'treadmill', 2.5, 'extra_heavy', 'garage', false, 804),
('Exercise Bike / Elliptical', 'exercise-bike-elliptical', 2.0, 'heavy', 'garage', false, 805),
-- ======= SPECIALTY / HIGH VALUE (8 items) =======
('Piano (upright)', 'piano-upright', 3.0, 'extra_heavy', 'specialty', false, 900),
('Piano (grand/baby grand)', 'piano-grand-baby-grand', 3.0, 'extra_heavy', 'specialty', false, 901),
('Safe/Vault', 'safe-vault', 3.0, 'extra_heavy', 'specialty', false, 902),
('Pool Table', 'pool-table', 3.0, 'extra_heavy', 'specialty', false, 903),
('Marble/Stone Table', 'marble-stone-table', 3.0, 'extra_heavy', 'specialty', false, 904),
('Large Artwork/Framed Piece', 'large-artwork-framed-piece', 1.0, 'medium', 'specialty', false, 905),
('Sculpture/Statue', 'sculpture-statue', 1.5, 'heavy', 'specialty', false, 906),
('Aquarium (large)', 'aquarium-large', 2.0, 'heavy', 'specialty', false, 907),
-- ======= MISC (4 items) =======
('Mirror (large/full length)', 'mirror-large-full-length', 0.5, 'light', 'other', true, 1000),
('Rug (large)', 'rug-large', 1.0, 'medium', 'other', false, 1001),
('Coat Rack/Hall Tree', 'coat-rack-hall-tree', 0.5, 'light', 'other', false, 1002),
('Shoe Rack/Storage', 'shoe-rack-storage', 0.5, 'light', 'other', false, 1003)
ON CONFLICT (slug) DO UPDATE SET
  item_name = EXCLUDED.item_name,
  weight_score = EXCLUDED.weight_score,
  category = EXCLUDED.category,
  room = EXCLUDED.room,
  is_common = EXCLUDED.is_common,
  display_order = EXCLUDED.display_order;

-- Add moves columns for inventory (items JSON, inventory_score, est_crew_size, est_hours, est_truck_size)
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS inventory_score NUMERIC;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS est_crew_size INTEGER;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS est_hours NUMERIC;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS est_truck_size TEXT;
