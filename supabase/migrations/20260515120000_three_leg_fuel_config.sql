-- Three-leg fuel cost configuration.
--
-- The margin engine previously approximated total driving as
-- `distanceKm + 15km` (a flat avg_deadhead_km). That was fine for
-- in-city jobs but undercounted obvious cases — e.g. a Stouffville job
-- with 55km deadhead each way got priced for 11.7km of fuel when the
-- actual cost was ~110km of empty driving + the loaded route.
--
-- New model: compute the three legs explicitly using haversine from a
-- configurable base-office coordinate plus per-truck $/km rates with
-- a loaded vs empty multiplier. Keys below feed
-- calcThreeLegFuelCost() in src/lib/pricing/three-leg-fuel.ts.

INSERT INTO platform_config (key, value, description) VALUES
  ('base_office_lat',  '43.6543', 'Yugo office latitude — 507 King St E, Toronto'),
  ('base_office_lng', '-79.3577', 'Yugo office longitude — 507 King St E, Toronto'),
  ('fuel_rate_loaded_per_km',   '0.52', 'Fuel cost per km, loaded 26ft truck baseline (loaded baseline)'),
  ('fuel_rate_empty_multiplier','0.73', 'Empty-truck fuel rate as a multiplier of the loaded rate (73% by default)'),
  ('fuel_rate_sprinter_per_km', '0.18', 'Fuel cost per km, Sprinter van'),
  ('fuel_rate_16ft_per_km',     '0.32', 'Fuel cost per km, 16ft truck'),
  ('fuel_rate_20ft_per_km',     '0.42', 'Fuel cost per km, 20ft truck'),
  ('fuel_rate_24ft_per_km',     '0.48', 'Fuel cost per km, 24ft truck'),
  ('fuel_rate_26ft_per_km',     '0.52', 'Fuel cost per km, 26ft truck')
ON CONFLICT (key) DO UPDATE
  SET value       = EXCLUDED.value,
      description = EXCLUDED.description;
