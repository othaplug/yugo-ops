-- Add-ons table and seed data for the Yugo pricing / quoting system.

CREATE TABLE IF NOT EXISTS public.addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  price_type TEXT NOT NULL CHECK (price_type IN ('flat','per_unit','tiered','percent')),
  unit_label TEXT,
  tiers JSONB,
  percent_value NUMERIC,
  applicable_service_types TEXT[] NOT NULL,
  excluded_tiers TEXT[],
  show_on_quote_page BOOLEAN DEFAULT TRUE,
  show_on_admin_form BOOLEAN DEFAULT TRUE,
  is_popular BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addons_active ON public.addons(active);
CREATE INDEX IF NOT EXISTS idx_addons_service ON public.addons USING GIN(applicable_service_types);

-- ═══ RESIDENTIAL ═══

INSERT INTO public.addons (name, slug, description, price, price_type, unit_label, applicable_service_types, excluded_tiers, is_popular, display_order) VALUES
  ('Packing materials kit', 'packing_materials', 'Boxes, tape, bubble wrap, paper. Enough for 1-2BR.', 89, 'flat', NULL, '{local_move,long_distance}', NULL, true, 1),
  ('Full packing service', 'full_packing', 'Professional crew packs your entire home.', 0, 'tiered', NULL, '{local_move}', '{estate}', true, 2),
  ('Unpacking service', 'unpacking', 'Crew unpacks all boxes at destination.', 0, 'tiered', NULL, '{local_move}', '{estate}', false, 3),
  ('Extra truck', 'extra_truck', 'Second truck for oversized moves.', 350, 'flat', NULL, '{local_move,long_distance}', NULL, false, 4),
  ('Storage', 'storage_daily', 'Secure climate-controlled storage.', 25, 'per_unit', 'per day', '{local_move,long_distance}', NULL, false, 5),
  ('Junk removal', 'junk_removal', 'Haul away unwanted items.', 0, 'tiered', NULL, '{local_move,long_distance,office_move}', NULL, true, 6),
  ('Cleaning (move-out)', 'cleaning_origin', 'Professional cleaning of origin property.', 175, 'flat', NULL, '{local_move}', NULL, false, 7),
  ('Cleaning (move-in)', 'cleaning_destination', 'Clean destination before unloading.', 175, 'flat', NULL, '{local_move}', NULL, false, 8),
  ('TV wall mounting', 'tv_mounting', 'Mount TVs at destination. Bring your mount or add $40.', 89, 'per_unit', 'per TV', '{local_move,single_item}', NULL, false, 9),
  ('Furniture assembly (extra)', 'extra_assembly', 'Beyond basic reassembly included in service.', 75, 'per_unit', 'per item', '{local_move}', NULL, false, 10),
  ('Floor protection upgrade', 'floor_protection', 'Heavy-duty runners, booties, door guards.', 60, 'flat', NULL, '{local_move}', '{premier,estate}', false, 11),
  ('Wardrobe boxes', 'wardrobe_boxes', 'Tall boxes for hanging clothes. Returned after.', 15, 'per_unit', 'per box', '{local_move,long_distance}', NULL, false, 12),
  ('Mattress bag', 'mattress_bag', 'Sealed plastic mattress protection.', 12, 'per_unit', 'per mattress', '{local_move,long_distance}', NULL, false, 13),
  ('Picture/mirror crating', 'picture_crating', 'Custom cardboard crate for large frames.', 40, 'per_unit', 'per piece', '{local_move,long_distance}', NULL, false, 14),
  ('Appliance servicing', 'appliance_service', 'Disconnect/reconnect washer, dryer, dishwasher.', 75, 'per_unit', 'per appliance', '{local_move}', NULL, false, 15)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.addons SET tiers = '[
  {"label": "Studio/1BR", "price": 350},
  {"label": "2BR", "price": 500},
  {"label": "3BR", "price": 650},
  {"label": "4BR+", "price": 800}
]'::jsonb WHERE slug = 'full_packing' AND tiers IS NULL;

UPDATE public.addons SET tiers = '[
  {"label": "Studio/1BR", "price": 250},
  {"label": "2BR", "price": 350},
  {"label": "3BR", "price": 450},
  {"label": "4BR+", "price": 500}
]'::jsonb WHERE slug = 'unpacking' AND tiers IS NULL;

UPDATE public.addons SET tiers = '[
  {"label": "Small load", "price": 150},
  {"label": "Half truck", "price": 250},
  {"label": "Full truck", "price": 350}
]'::jsonb WHERE slug = 'junk_removal' AND tiers IS NULL;

-- ═══ LONG DISTANCE EXTRAS ═══

INSERT INTO public.addons (name, slug, description, price, price_type, unit_label, applicable_service_types, display_order) VALUES
  ('Storage at origin', 'storage_origin', 'If gap between move-out and pickup.', 30, 'per_unit', 'per day', '{long_distance}', 20),
  ('Storage at destination', 'storage_dest', 'Hold items until delivery date.', 30, 'per_unit', 'per day', '{long_distance}', 21),
  ('Custom crating', 'custom_crating', 'Wooden crate for fragile/high-value items.', 150, 'per_unit', 'per item', '{long_distance,specialty}', 22),
  ('Vehicle transport', 'vehicle_transport', 'Add car or motorcycle to same trip.', 800, 'flat', NULL, '{long_distance}', 23),
  ('Priority express delivery', 'express_delivery', 'Guaranteed delivery within 24hrs of pickup.', 0, 'percent', NULL, '{long_distance}', 24)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.addons SET percent_value = 0.15 WHERE slug = 'express_delivery' AND percent_value IS NULL;

-- ═══ OFFICE ═══

INSERT INTO public.addons (name, slug, description, price, price_type, unit_label, applicable_service_types, display_order) VALUES
  ('IT disconnect/reconnect (basic)', 'it_basic', 'Workstations and printers.', 300, 'flat', NULL, '{office_move}', 30),
  ('IT disconnect/reconnect (full)', 'it_full', 'Full server room + networking.', 600, 'flat', NULL, '{office_move}', 31),
  ('After-hours execution', 'after_hours', 'Evenings after 6PM or overnight.', 0, 'percent', NULL, '{office_move}', 32),
  ('Building COI processing', 'building_coi', 'Certificate of Insurance for building mgmt.', 50, 'flat', NULL, '{office_move}', 33),
  ('Furniture disposal', 'furniture_disposal', 'Remove and dispose of old furniture.', 0, 'tiered', NULL, '{office_move}', 34),
  ('Workstation labeling system', 'workstation_labels', 'Pre-move labeling for organized reassembly.', 75, 'flat', NULL, '{office_move}', 35),
  ('Post-move IT verification', 'it_verification', 'Verify all devices powered on and connected.', 150, 'flat', NULL, '{office_move}', 36),
  ('Signage installation', 'signage_install', 'Install company signage at new location.', 100, 'flat', NULL, '{office_move}', 37),
  ('Secure document shredding', 'shredding', 'Certified shredding of old files.', 100, 'flat', NULL, '{office_move}', 38)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.addons SET percent_value = 0.15 WHERE slug = 'after_hours' AND percent_value IS NULL;

UPDATE public.addons SET tiers = '[
  {"label": "Small (under 10 items)", "price": 200},
  {"label": "Medium (10-30 items)", "price": 350},
  {"label": "Large (30+ items)", "price": 500}
]'::jsonb WHERE slug = 'furniture_disposal' AND tiers IS NULL;

-- ═══ SINGLE ITEM ═══

INSERT INTO public.addons (name, slug, description, price, price_type, unit_label, applicable_service_types, display_order) VALUES
  ('Disassembly at pickup', 'disassembly', 'Take apart item for transport.', 75, 'flat', NULL, '{single_item}', 40),
  ('Assembly at delivery', 'assembly', 'Reassemble item at destination.', 80, 'flat', NULL, '{single_item}', 41),
  ('Disassembly + assembly bundle', 'disassembly_assembly', 'Both services — discounted.', 140, 'flat', NULL, '{single_item}', 42),
  ('Stair carry', 'stair_carry', 'When no elevator available.', 50, 'per_unit', 'per flight', '{single_item,local_move}', 43),
  ('Packaging removal', 'packaging_removal', 'Remove all packaging and dispose.', 30, 'flat', NULL, '{single_item}', 44),
  ('Waiting time', 'waiting_time', 'If crew waits beyond 15 min at either stop.', 25, 'per_unit', 'per 15 min', '{single_item}', 45)
ON CONFLICT (slug) DO NOTHING;

-- ═══ WHITE GLOVE ═══

INSERT INTO public.addons (name, slug, description, price, price_type, unit_label, applicable_service_types, display_order) VALUES
  ('Enhanced insurance rider', 'enhanced_insurance', 'Full replacement value coverage.', 0, 'tiered', NULL, '{white_glove}', 50),
  ('Stair carry (white glove)', 'stair_carry_wg', 'Premium handling on stairs.', 75, 'per_unit', 'per flight', '{white_glove}', 51),
  ('Custom protective crating', 'protective_crating', 'Wooden crate built to item spec.', 150, 'per_unit', 'per piece', '{white_glove,specialty}', 52),
  ('Same-day delivery', 'same_day', 'Priority scheduling if available.', 100, 'flat', NULL, '{white_glove,single_item}', 53),
  ('Second delivery attempt', 'second_attempt', 'If first attempt fails.', 75, 'flat', NULL, '{white_glove,single_item}', 54)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.addons SET tiers = '[
  {"label": "Items under $5K", "price": 50},
  {"label": "Items $5K-$15K", "price": 100},
  {"label": "Items over $15K", "price": 150}
]'::jsonb WHERE slug = 'enhanced_insurance' AND tiers IS NULL;

-- ═══ QUOTES: selected_addons column ═══

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS selected_addons JSONB DEFAULT '[]';

-- ═══ RLS ═══

ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can manage addons" ON public.addons;
CREATE POLICY "Platform users can manage addons"
  ON public.addons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can read active addons" ON public.addons;
CREATE POLICY "Anyone can read active addons"
  ON public.addons FOR SELECT
  USING (active = true);
