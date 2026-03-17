-- Square receipt URL for moves (payment confirmation from Square)
ALTER TABLE moves ADD COLUMN IF NOT EXISTS square_receipt_url TEXT;

-- B2B delivery access + weight surcharges
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_access TEXT DEFAULT 'elevator';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS item_weight_category TEXT DEFAULT 'standard';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS access_surcharge NUMERIC DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS weight_surcharge NUMERIC DEFAULT 0;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS pricing_breakdown JSONB;

-- B2B access surcharges (platform_config)
INSERT INTO platform_config (key, value, description) VALUES
('b2b_access_surcharges', '{
  "elevator": 0,
  "ground_floor": 0,
  "loading_dock": 0,
  "walk_up_2nd": 50,
  "walk_up_3rd": 100,
  "walk_up_4th_plus": 175,
  "long_carry": 75,
  "narrow_stairs": 100,
  "no_parking": 50
}', 'B2B delivery access surcharges. Lower than residential because B2B items are typically single pieces.')
ON CONFLICT (key) DO NOTHING;

-- B2B weight surcharges (platform_config)
INSERT INTO platform_config (key, value, description) VALUES
('b2b_weight_surcharges', '{
  "standard": 0,
  "heavy": 50,
  "very_heavy": 100,
  "oversized_fragile": 175
}', 'B2B delivery weight/complexity surcharges. Applied per delivery.')
ON CONFLICT (key) DO NOTHING;
