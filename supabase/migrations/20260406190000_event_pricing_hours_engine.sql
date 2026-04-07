-- Event pricing v2: hours-based engine (crew × hours × mover rate), km, wrapping, return defaults

INSERT INTO public.platform_config (key, value, description) VALUES
  ('event_crew_rate_standard', '80', 'Event standard: $ per mover per billable hour'),
  ('event_crew_rate_luxury', '95', 'Event luxury / white glove: $ per mover per hour'),
  ('event_minimum', '400', 'Minimum pre-tax subtotal for delivery + return legs (before paid setup)'),
  ('event_free_km', '20', 'One-way road km included before per-km surcharge'),
  ('event_per_km', '3', '$ per km over free km (one-way leg)'),
  ('event_wrap_per_item', '15', '$ per item unit when coordinator marks requires wrapping'),
  ('event_default_return_rate_different', '0.60', 'Auto return as fraction of delivery day (different addresses)'),
  ('event_default_return_rate_same_venue', '0.80', 'Auto return fraction (same venue / on-site legs)'),
  ('event_box_light_minutes_per', '1', 'Handling minutes per light box (one pass; load+unload uses ×2 in engine)'),
  ('event_box_heavy_minutes_per', '3', 'Minutes per heavy box (one pass)'),
  ('event_furniture_minutes_per', '8', 'Minutes per furniture / custom unit (one pass)'),
  ('event_fragile_minutes_per', '15', 'Minutes per fragile unit when not using wrap flag path'),
  ('event_equipment_minutes_per', '10', 'Minutes per equipment unit (one pass)'),
  ('event_wrapping_handling_minutes_per', '15', 'Minutes per unit when requires_wrapping (load+unload ×2 in engine)'),
  ('event_hours_buffer_multiplier', '1.15', 'Multiplier on summed hours before min floor / billable minimums'),
  ('event_min_hours_floor', '2', 'Minimum estimated hours after buffer (before coordinator override / min billable)')
ON CONFLICT (key) DO NOTHING;
