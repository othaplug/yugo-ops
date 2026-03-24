-- Convert packing materials kit from flat $89 to tiered pricing by move size.
-- Tiers are ordered: Studio (0), 1BR (1), 2BR (2), 3BR (3), 4BR (4), 5BR+ (5).
-- The frontend maps move_size → tier index automatically (no user dropdown).

UPDATE public.addons
SET
  price_type   = 'tiered',
  price        = 120,
  description  = 'Boxes, tape, packing paper, wardrobe boxes (rental). Free delivery to your door.',
  tiers        = '[
    {"label": "Studio",      "price": 120},
    {"label": "1 Bedroom",   "price": 160},
    {"label": "2 Bedroom",   "price": 240},
    {"label": "3 Bedroom",   "price": 420},
    {"label": "4 Bedroom",   "price": 660},
    {"label": "5+ Bedroom",  "price": 850}
  ]'::jsonb,
  is_popular   = true,
  updated_at   = NOW()
WHERE slug = 'packing_materials';
