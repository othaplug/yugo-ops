-- ══════════════════════════════════════════════════
-- Valuation Protection System
-- ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.valuation_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  rate_description TEXT NOT NULL,
  rate_per_pound NUMERIC,
  max_per_item NUMERIC,
  max_per_shipment NUMERIC,
  deductible NUMERIC DEFAULT 0,
  included_in_package TEXT NOT NULL,
  damage_process TEXT NOT NULL,
  covers TEXT[] NOT NULL,
  excludes TEXT[] NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.valuation_tiers (
  tier_slug, display_name, rate_description,
  rate_per_pound, max_per_item, max_per_shipment, deductible,
  included_in_package, damage_process, covers, excludes
) VALUES
(
  'released', 'Released Value Protection',
  '$0.60 per pound per article',
  0.60, NULL, NULL, 0,
  'essentials',
  'Reimburse at $0.60 per pound of damaged item',
  ARRAY['Loss or damage during loading, transit, and unloading',
        'Items on the move inventory',
        'Furniture, appliances, and electronics handled by crew'],
  ARRAY['Contents of self-packed boxes',
        'Pre-existing damage or wear',
        'Items not on the move inventory',
        'Natural disasters or acts of God',
        'Mechanical or electrical failure of appliances']
),
(
  'enhanced', 'Enhanced Value Protection',
  '$5.00 per pound per article, $2,500 max per item',
  5.00, 2500, 25000, 0,
  'premier',
  'Professional repair to pre-move condition. If unrepairable, reimburse at $5.00/lb up to $2,500 per item.',
  ARRAY['Loss or damage during loading, transit, and unloading',
        'Professional repair to pre-move condition',
        'Reimbursement if repair not possible',
        'Items packed by Yugo crew (if packing service selected)',
        'All items on the move inventory'],
  ARRAY['Contents of self-packed boxes (unless packing add-on purchased)',
        'Pre-existing damage or wear',
        'Items valued over $2,500 unless individually declared',
        'Items not on the move inventory',
        'Natural disasters or acts of God']
),
(
  'full_replacement', 'Full Replacement Value Protection',
  'Full current market replacement value, $10,000 max per item',
  NULL, 10000, 100000, 0,
  'estate',
  'Repair by professional restorer, replace with equivalent item at current market value, or full cash settlement.',
  ARRAY['Loss or damage during loading, transit, and unloading',
        'Professional repair by certified restorer',
        'Full replacement with equivalent item at market value',
        'Cash settlement at full replacement cost',
        'Items packed by Yugo crew',
        'Pre-move inventory walkthrough documentation',
        'All items on inventory up to $10,000 per item'],
  ARRAY['Contents of self-packed boxes',
        'Pre-existing damage documented in walkthrough',
        'Items valued over $10,000 unless individually declared',
        'Items not on the move inventory',
        'Natural disasters or acts of God']
)
ON CONFLICT (tier_slug) DO NOTHING;

-- ── Upgrade pricing by move size ──

CREATE TABLE IF NOT EXISTS public.valuation_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_size TEXT NOT NULL,
  from_package TEXT NOT NULL,
  to_tier TEXT NOT NULL,
  price NUMERIC NOT NULL,
  assumed_shipment_value NUMERIC NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(move_size, from_package, to_tier)
);

INSERT INTO public.valuation_upgrades
  (move_size, from_package, to_tier, price, assumed_shipment_value)
VALUES
  ('studio',   'essentials', 'enhanced', 100, 5000),
  ('1br',      'essentials', 'enhanced', 125, 10000),
  ('2br',      'essentials', 'enhanced', 150, 20000),
  ('3br',      'essentials', 'enhanced', 200, 35000),
  ('4br',      'essentials', 'enhanced', 250, 50000),
  ('5br_plus', 'essentials', 'enhanced', 350, 75000),
  ('studio',   'premier', 'full_replacement', 150, 5000),
  ('1br',      'premier', 'full_replacement', 200, 10000),
  ('2br',      'premier', 'full_replacement', 300, 20000),
  ('3br',      'premier', 'full_replacement', 450, 35000),
  ('4br',      'premier', 'full_replacement', 600, 50000),
  ('5br_plus', 'premier', 'full_replacement', 900, 75000)
ON CONFLICT (move_size, from_package, to_tier) DO NOTHING;

-- ── High-value item declarations ──

CREATE TABLE IF NOT EXISTS public.high_value_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID,
  move_id UUID,
  item_name TEXT NOT NULL,
  description TEXT,
  declared_value NUMERIC NOT NULL,
  weight_lbs NUMERIC,
  photo_url TEXT,
  fee NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hvd_quote ON public.high_value_declarations(quote_id);
CREATE INDEX IF NOT EXISTS idx_hvd_move ON public.high_value_declarations(move_id);

-- ── Add valuation columns to quotes ──

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS valuation_tier TEXT DEFAULT 'released';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS valuation_upgraded BOOLEAN DEFAULT FALSE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS valuation_upgrade_cost NUMERIC DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS declaration_total NUMERIC DEFAULT 0;

-- ── Same columns on moves ──

ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS valuation_tier TEXT DEFAULT 'released';
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS valuation_upgrade_cost NUMERIC DEFAULT 0;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS declaration_total NUMERIC DEFAULT 0;

-- ── Declaration config in platform_config ──

INSERT INTO public.platform_config (key, value, description) VALUES
  ('declaration_fee_pct', '0.02', 'High-value item declaration fee percentage'),
  ('declaration_min_fee', '50', 'Minimum declaration fee in dollars'),
  ('declaration_custom_threshold', '50000', 'Value above which custom coverage arrangement is required')
ON CONFLICT (key) DO NOTHING;

-- ── RLS ──

ALTER TABLE public.valuation_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.high_value_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "valuation_tiers_public_read" ON public.valuation_tiers FOR SELECT USING (true);
CREATE POLICY "valuation_upgrades_public_read" ON public.valuation_upgrades FOR SELECT USING (true);

CREATE POLICY "hvd_admin_all" ON public.high_value_declarations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator')));

CREATE POLICY "hvd_insert_anon" ON public.high_value_declarations FOR INSERT WITH CHECK (true);
