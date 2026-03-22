-- Pricing Engine v2: add new platform_config keys
-- Many of these may already exist — INSERT ... ON CONFLICT DO NOTHING ensures idempotency

INSERT INTO platform_config (key, value) VALUES
  -- Inventory modifier
  ('inventory_modifier_floor',        '0.72'),
  ('inventory_modifier_cap',          '1.50'),

  -- Market stack cap (neighbourhood × day × season × urgency)
  ('market_stack_cap',                '1.38'),

  -- Tiered labour rates (per mover per hour, applied AFTER tier multiplier)
  ('labour_rate_curated',             '55'),
  ('labour_rate_signature',           '65'),
  ('labour_rate_estate',              '75'),

  -- Deadhead (crew travel from base)
  ('deadhead_rate_per_km',            '3.00'),
  ('deadhead_free_zone_km',           '15'),

  -- Mobilization fee (flat, for distant jobs)
  ('mobilization_25_35',              '50'),
  ('mobilization_35_50',              '75'),
  ('mobilization_50plus',             '100'),

  -- Minimum hours per move size (prevents pricing below real operational floor)
  ('minimum_hours_by_size',           '{"studio":2,"1br":3,"2br":4,"3br":5.5,"4br":7,"5br_plus":8.5,"partial":2}'),

  -- Cost tracking (for margin calculation)
  ('cost_per_mover_hour',             '33'),
  ('truck_costs_per_job',             '{"sprinter":90,"16ft":115,"20ft":150,"24ft":175,"26ft":200}'),
  ('fuel_cost_per_km',                '0.45'),

  -- Change request tiered rates
  ('change_request_rate_curated',     '30'),
  ('change_request_rate_signature',   '40'),
  ('change_request_rate_estate',      '55')

ON CONFLICT (key) DO NOTHING;
