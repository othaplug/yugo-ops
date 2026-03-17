-- Pricing Algorithm Calibration Migration
-- Run once in Supabase SQL editor to seed all new platform_config keys.

-- ── Section 1: Inventory modifier floor & cap ─────────────────────────────
INSERT INTO platform_config (key, value, description)
VALUES
  ('inventory_modifier_floor', '0.65', 'Minimum inventory modifier — light moves get up to 35% discount (was 0.80)'),
  ('inventory_modifier_cap',   '1.50', 'Maximum inventory modifier — heavy moves pay up to 50% premium')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- ── Section 4A/4B: Distance modifiers (replace flat per-km surcharge) ─────
INSERT INTO platform_config (key, value, description)
VALUES
  ('dist_ultra_short_km',  '2',    'Upper bound for ultra-short distance (km)'),
  ('dist_short_km',        '5',    'Upper bound for short distance (km)'),
  ('dist_baseline_km',     '20',   'Upper bound for baseline distance (km) — no surcharge'),
  ('dist_medium_km',       '40',   'Upper bound for medium distance (km)'),
  ('dist_long_km',         '60',   'Upper bound for long distance (km)'),
  ('dist_very_long_km',    '100',  'Upper bound for very long distance (km)'),

  ('dist_mod_ultra_short', '0.92', 'Distance modifier for ≤2 km (8% discount)'),
  ('dist_mod_short',       '0.95', 'Distance modifier for ≤5 km (5% discount)'),
  ('dist_mod_medium',      '1.08', 'Distance modifier for ≤40 km (8% surcharge)'),
  ('dist_mod_long',        '1.15', 'Distance modifier for ≤60 km (15% surcharge)'),
  ('dist_mod_very_long',   '1.25', 'Distance modifier for ≤100 km (25% surcharge)'),
  ('dist_mod_extreme',     '1.35', 'Distance modifier for >100 km (35% surcharge)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- ── Section 4D: Deadhead surcharge ────────────────────────────────────────
INSERT INTO platform_config (key, value, description)
VALUES
  ('deadhead_free_km', '15',   'Deadhead free zone radius (km) from Yugo base — no charge within this range'),
  ('deadhead_per_km',  '2.50', 'Deadhead surcharge per excess km beyond free zone ($)')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;
