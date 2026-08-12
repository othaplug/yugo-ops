-- Long-distance relocation: fold long_distance into the residential tier
-- engine and price the incremental transit cost. Every value is sourced
-- (see src/lib/pricing/long-distance.ts). All tunable via platform_config.

INSERT INTO public.platform_config (key, value) VALUES
  ('long_distance_km_threshold', '100'),      -- leaves GTA + adjacent cities; matches dist_very_long_km + max_deadhead_km
  ('ld_overnight_trigger_hours', '5'),        -- one-way drive beyond this can't round-trip safely in a day
  ('ld_transit_labour_margin', '1.45'),       -- crew drive time is a real service
  ('ld_fuel_margin', '1.2'),                  -- fuel: cost + light surcharge
  ('ld_overnight_margin', '1.1'),             -- lodging/meals: near pass-through
  ('ld_hotel_per_room_night', '140'),         -- Ontario budget-mid hotel
  ('ld_per_diem_per_crew_night', '69'),       -- CRA simplified meal max
  ('ld_crew_per_room', '2'),
  ('ld_deposit_pct', '0.25')                  -- holds a dedicated truck + crew for a multi-day route
ON CONFLICT (key) DO NOTHING;
