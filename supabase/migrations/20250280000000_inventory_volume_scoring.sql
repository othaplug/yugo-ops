-- ══════════════════════════════════════════════════
-- Inventory Volume Scoring for Quoting Algorithm
-- ══════════════════════════════════════════════════

-- Item weights table: each item type has a weight score
CREATE TABLE IF NOT EXISTS public.item_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  weight_score NUMERIC NOT NULL DEFAULT 1.0,
  category TEXT NOT NULL DEFAULT 'furniture',
  is_common BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Volume benchmarks: per move-size expected scores
CREATE TABLE IF NOT EXISTS public.volume_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_size TEXT NOT NULL UNIQUE,
  std_major_items INTEGER NOT NULL,
  std_item_score NUMERIC NOT NULL,
  assumed_boxes INTEGER NOT NULL,
  box_score NUMERIC NOT NULL,
  benchmark_score NUMERIC NOT NULL,
  min_modifier NUMERIC NOT NULL DEFAULT 0.80,
  max_modifier NUMERIC NOT NULL DEFAULT 1.30,
  min_items_for_adjustment INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed item weights
INSERT INTO public.item_weights (item_name, slug, weight_score, category, is_common, display_order) VALUES
-- HEAVY (2.0)
('Sofa / Couch', 'sofa', 2.0, 'furniture', true, 10),
('Loveseat', 'loveseat', 2.0, 'furniture', true, 11),
('Sectional Sofa', 'sectional', 2.0, 'furniture', true, 12),
('Bed Frame + Mattress (Single)', 'bed-single', 2.0, 'furniture', true, 20),
('Bed Frame + Mattress (Double)', 'bed-double', 2.0, 'furniture', true, 21),
('Bed Frame + Mattress (Queen)', 'bed-queen', 2.0, 'furniture', true, 22),
('Bed Frame + Mattress (King)', 'bed-king', 2.0, 'furniture', true, 23),
('Dining Table', 'dining-table', 2.0, 'furniture', true, 30),
('Dresser / Chest of Drawers', 'dresser', 2.0, 'furniture', true, 40),
('Wardrobe / Armoire', 'wardrobe', 2.0, 'furniture', true, 41),
('Desk (large/heavy)', 'desk-large', 2.0, 'furniture', true, 42),
('Fridge / Refrigerator', 'fridge', 2.0, 'appliance', true, 50),
('Washer', 'washer', 2.0, 'appliance', false, 51),
('Dryer', 'dryer', 2.0, 'appliance', false, 52),
('Treadmill / Gym Equipment', 'treadmill', 2.0, 'other', false, 60),
-- MEDIUM (1.0)
('Dining Chair', 'dining-chair', 1.0, 'furniture', true, 100),
('Accent Chair / Armchair', 'accent-chair', 1.0, 'furniture', true, 101),
('Nightstand / Bedside Table', 'nightstand', 1.0, 'furniture', true, 102),
('Coffee Table', 'coffee-table', 1.0, 'furniture', true, 103),
('Side / End Table', 'side-table', 1.0, 'furniture', true, 104),
('TV Stand / Entertainment Unit', 'tv-stand', 1.0, 'furniture', true, 105),
('Bookshelf', 'bookshelf', 1.0, 'furniture', true, 106),
('TV (40-65 inch)', 'tv-large', 1.0, 'electronics', true, 107),
('Desk (small/medium)', 'desk-small', 1.0, 'furniture', true, 108),
('Office Chair', 'office-chair', 1.0, 'furniture', false, 109),
('Microwave', 'microwave', 1.0, 'appliance', false, 110),
('Bar Cart', 'bar-cart', 1.0, 'furniture', false, 111),
('Shoe Rack / Storage Shelf', 'shoe-rack', 1.0, 'furniture', false, 112),
-- LIGHT (0.5)
('Lamp (floor)', 'lamp-floor', 0.5, 'decor', true, 200),
('Lamp (table)', 'lamp-table', 0.5, 'decor', false, 201),
('Mirror (wall)', 'mirror', 0.5, 'decor', false, 202),
('Ottoman / Pouf', 'ottoman', 0.5, 'furniture', false, 203),
('Stool / Bar Stool', 'stool', 0.5, 'furniture', false, 204),
('TV (under 40 inch)', 'tv-small', 0.5, 'electronics', false, 205),
('Monitor', 'monitor', 0.5, 'electronics', false, 206),
('Small Table / Plant Stand', 'small-table', 0.5, 'furniture', false, 207),
('Rug (rolled)', 'rug', 0.5, 'decor', false, 208),
-- EXTRA HEAVY (3.0)
('Piano (upright)', 'piano-upright', 3.0, 'other', false, 300),
('Piano (grand)', 'piano-grand', 3.0, 'other', false, 301),
('Safe (under 300lbs)', 'safe-light', 3.0, 'other', false, 302),
('Safe (over 300lbs)', 'safe-heavy', 3.0, 'other', false, 303),
('Pool Table', 'pool-table', 3.0, 'other', false, 304),
('Hot Tub', 'hot-tub', 3.0, 'other', false, 305)
ON CONFLICT (slug) DO NOTHING;

-- Seed volume benchmarks
INSERT INTO public.volume_benchmarks
(move_size, std_major_items, std_item_score, assumed_boxes, box_score, benchmark_score, min_items_for_adjustment)
VALUES
('studio',     10,  12.0,  15,  4.5,  16.5,  5),
('1br',        18,  21.0,  30,  9.0,  30.0,  9),
('2br',        30,  35.0,  45, 13.5,  48.5, 15),
('3br',        47,  55.0,  65, 19.5,  74.5, 24),
('4br',        65,  76.0,  90, 27.0, 103.0, 33),
('5br_plus',   88, 103.0, 120, 36.0, 139.0, 44),
('partial',     6,   7.0,  10,  3.0,  10.0,  3)
ON CONFLICT (move_size) DO NOTHING;

-- Add labour estimate columns to quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS inventory_items JSONB DEFAULT '[]';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS inventory_score NUMERIC;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS inventory_modifier NUMERIC;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS est_crew_size INTEGER;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS est_hours NUMERIC;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS est_truck_size TEXT;

-- RLS
ALTER TABLE public.item_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volume_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage item_weights" ON public.item_weights
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage volume_benchmarks" ON public.volume_benchmarks
  FOR ALL USING (true) WITH CHECK (true);
