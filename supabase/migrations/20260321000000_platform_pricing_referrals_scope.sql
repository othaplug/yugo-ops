-- Premium packing kit (single-item / residential add-on)
INSERT INTO public.addons (name, slug, description, price, price_type, unit_label, applicable_service_types, excluded_tiers, is_popular, display_order, active)
VALUES (
  'Premium packing materials kit',
  'packing_materials_premium',
  'Premium boxes, tape, bubble, paper — larger homes / full rooms.',
  149,
  'flat',
  NULL,
  '{local_move,long_distance}',
  NULL,
  false,
  1,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Tier spread + office + single-item defaults (editable in Platform)
INSERT INTO public.platform_config (key, value, description) VALUES
  ('office_crew_hourly_rate', '150', 'Office move: $/hr for crew-time block (× estimated hours).'),
  ('single_item_base_fee', '255', 'Single-item pricing: base bundle (first item).'),
  ('single_item_additional_fee', '50', 'Single-item: each additional item beyond the first.'),
  ('min_curated_signature_gap', '350', 'Residential: min $ between Curated and Signature (pre-tax).'),
  ('min_signature_estate_gap', '800', 'Residential: min $ between Signature and Estate (pre-tax).'),
  ('max_curated_signature_gap', '1200', 'Residential: max $ gap Curated → Signature.'),
  ('max_signature_estate_gap', '3000', 'Residential: max $ gap Signature → Estate.'),
  ('arrival_window_options', '["Early Morning (6:00 AM – 8:00 AM)","Morning (8:00 AM – 10:00 AM)","Late Morning (10:00 AM – 12:00 PM)","Early Afternoon (12:00 PM – 2:00 PM)","Afternoon (2:00 PM – 4:00 PM)","Late Afternoon (4:00 PM – 6:00 PM)","Evening (6:00 PM – 8:00 PM)"]', 'JSON array of arrival window labels for moves/quotes.')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS referral_source_type TEXT,
  ADD COLUMN IF NOT EXISTS referral_source_id UUID,
  ADD COLUMN IF NOT EXISTS referral_source_name TEXT;

CREATE TABLE IF NOT EXISTS public.scope_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  original_scope JSONB,
  actual_scope TEXT,
  change_types TEXT[],
  original_price NUMERIC,
  adjusted_price NUMERIC,
  reason TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scope_changes_delivery ON public.scope_changes(delivery_id);
CREATE INDEX IF NOT EXISTS idx_scope_changes_move ON public.scope_changes(move_id);

-- Inventory seeds (fragile / specialty)
INSERT INTO public.item_weights (item_name, slug, weight_score, category, is_common, display_order, active) VALUES
  ('Shelving Unit (glass)', 'shelving_unit_glass', 2.0, 'furniture', false, 950, true),
  ('Marble Dining Table', 'marble_dining_table', 3.0, 'furniture', false, 951, true),
  ('Glass Coffee Table', 'glass_coffee_table', 1.5, 'furniture', false, 952, true),
  ('China Cabinet', 'china_cabinet', 2.5, 'furniture', false, 953, true)
ON CONFLICT (slug) DO NOTHING;
