-- Prompt 94: Estate Supplies by Size + Crating Cost System

-- ── platform_config: estate supplies allowance by move size ──────────────────
INSERT INTO platform_config (key, value, description) VALUES
(
  'estate_supplies_by_size',
  '{"studio":250,"1br":300,"2br":375,"3br":575,"4br":850,"5br_plus":1100,"partial":150}',
  'Estate tier: included packing supplies allowance by move size. Covers boxes, tape, bubble wrap, wardrobe boxes, mattress bags, packing paper.'
)
ON CONFLICT (key) DO NOTHING;

-- ── platform_config: crating prices per piece by size ────────────────────────
INSERT INTO platform_config (key, value, description) VALUES
(
  'crating_prices',
  '{"small":175,"medium":250,"large":350,"oversized":500}',
  'Custom crating cost per piece. Small: art under 24in. Medium: art/mirrors 24-48in. Large: furniture/sculptures 48-72in. Oversized: 72in+.'
)
ON CONFLICT (key) DO NOTHING;

-- ── quotes table: new crating + supplies columns ──────────────────────────────
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS crating_pieces JSONB DEFAULT '[]';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS crating_total  NUMERIC DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS supplies_allowance NUMERIC DEFAULT 0;
