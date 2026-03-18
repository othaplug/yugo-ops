-- ═══════════════════════════════════════════════════════════════════════
-- PRICING ALGORITHM FINAL CALIBRATION — platform_config seed
-- Sections 1, 4, 10 from the Pricing Calibration prompt.
-- All values are used as fallbacks in cfgNum(); the algorithm already
-- hard-codes these same numbers, so this migration makes them editable
-- via the Pricing Admin → Distance Intelligence & Deadhead panel.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Section 1: Inventory modifier floor / cap ────────────────────────────
INSERT INTO public.platform_config (key, value, description) VALUES
  ('inventory_modifier_floor', '0.65',
   'Minimum inventory volume modifier (floor). Light moves get up to 35% discount on base rate. Was 0.80 before calibration.'),
  ('inventory_modifier_cap', '1.50',
   'Maximum inventory volume modifier (cap). Heavy moves pay up to 50% more than base rate.')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

-- ── Section 10: Distance modifier thresholds ────────────────────────────
INSERT INTO public.platform_config (key, value, description) VALUES
  ('dist_ultra_short_km', '2',
   'Distance threshold (km) below which the ultra-short discount applies (default ≤2 km).'),
  ('dist_short_km', '5',
   'Distance threshold (km) below which the short discount applies (default ≤5 km).'),
  ('dist_baseline_km', '20',
   'Distance threshold (km) up to which the modifier is 1.0 — the neutral baseline zone.'),
  ('dist_medium_km', '40',
   'Upper bound (km) for medium-distance surcharge bracket (>20 km and ≤40 km).'),
  ('dist_long_km', '60',
   'Upper bound (km) for long-distance surcharge bracket (>40 km and ≤60 km).'),
  ('dist_very_long_km', '100',
   'Upper bound (km) for very-long-distance surcharge bracket (>60 km and ≤100 km).')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

-- ── Section 10: Distance modifier multipliers ────────────────────────────
INSERT INTO public.platform_config (key, value, description) VALUES
  ('dist_mod_ultra_short', '0.92',
   'Price multiplier for moves ≤2 km (ultra-short) — 8% discount because fuel and transit time are near zero.'),
  ('dist_mod_short', '0.95',
   'Price multiplier for moves ≤5 km (short) — 5% discount.'),
  ('dist_mod_medium', '1.08',
   'Price multiplier for moves >20 km and ≤40 km — 8% surcharge (e.g. downtown → Oakville).'),
  ('dist_mod_long', '1.15',
   'Price multiplier for moves >40 km and ≤60 km — 15% surcharge.'),
  ('dist_mod_very_long', '1.25',
   'Price multiplier for moves >60 km and ≤100 km — 25% surcharge (e.g. downtown → Barrie).'),
  ('dist_mod_extreme', '1.35',
   'Price multiplier for moves >100 km — 35% surcharge.')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

-- ── Section 10: Deadhead (crew travel to job) config ────────────────────
INSERT INTO public.platform_config (key, value, description) VALUES
  ('deadhead_free_km', '15',
   'Kilometres from Yugo base (507 King St E, Toronto) within which no deadhead surcharge is charged. Default service area.'),
  ('deadhead_per_km', '2.50',
   'Surcharge per km beyond the free deadhead zone. Applied as a flat fee — not multiplied by tier.')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

-- ── Section 10: Yugo base address (informational, used in UI tooltips) ──
INSERT INTO public.platform_config (key, value, description) VALUES
  ('yugo_base_address', '507 King Street East, Toronto, ON',
   'Yugo operations base — used for deadhead (base→pickup) and return-trip (dropoff→base) distance calculations.')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;

-- ── Section 3 / 10: Labour rate confirmation ────────────────────────────
-- labour_rate_per_mover_hour already set to 45 in migration 20250403000000.
-- Upsert here ensures it stays at $45 even if an earlier migration had a
-- different value.
INSERT INTO public.platform_config (key, value, description) VALUES
  ('labour_rate_per_mover_hour', '45',
   'Incremental labour rate ($/mover/hr) for extra man-hours above the baseline. Applies to the labour delta component only.')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value;

-- ── Section 1: Update volume_benchmarks min_modifier floor to 0.65 ──────
-- The code reads inventory_modifier_floor from platform_config first
-- (now seeded above), but we also update the DB column so the two stay in
-- sync and legacy code paths that skip the config key still behave correctly.
UPDATE public.volume_benchmarks
SET    min_modifier = 0.65
WHERE  min_modifier = 0.80;
