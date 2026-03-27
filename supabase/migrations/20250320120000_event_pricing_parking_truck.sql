-- Event pricing, truck surcharges, parking/long carry for quotes & moves, public domain

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS from_parking TEXT DEFAULT 'dedicated';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS to_parking TEXT DEFAULT 'dedicated';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS from_long_carry BOOLEAN DEFAULT FALSE;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS to_long_carry BOOLEAN DEFAULT FALSE;

ALTER TABLE moves ADD COLUMN IF NOT EXISTS from_parking TEXT DEFAULT 'dedicated';
ALTER TABLE moves ADD COLUMN IF NOT EXISTS to_parking TEXT DEFAULT 'dedicated';
ALTER TABLE moves ADD COLUMN IF NOT EXISTS from_long_carry BOOLEAN DEFAULT FALSE;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS to_long_carry BOOLEAN DEFAULT FALSE;

INSERT INTO public.platform_config (key, value, description) VALUES
  ('event_base_hourly_rate', '150', 'Event crew hourly rate (pre-tax, per crew hour) — standard'),
  ('event_luxury_hourly_rate', '175', 'Event crew hourly rate — luxury / white glove'),
  ('event_min_hours_standard', '3', 'Minimum billable hours — standard event'),
  ('event_min_hours_luxury', '4', 'Minimum billable hours — luxury event'),
  ('event_return_discount', '0.65', 'Return day price as fraction of delivery day'),
  ('event_parking_surcharge', '75', 'Surcharge when no dedicated parking at venue/origin (event)'),
  ('event_long_carry_surcharge', '75', 'Event long carry (50m+) surcharge per leg when enabled'),
  ('event_min_deposit', '300', 'Minimum deposit for event quotes'),
  ('truck_surcharges', '{"sprinter":0,"16ft":75,"20ft":150,"26ft":250}', 'Truck size surcharges added to quote subtotal'),
  ('parking_surcharges', '{"dedicated":0,"street":0,"no_dedicated":75}', 'Parking situation surcharges (from/to)'),
  ('long_carry_surcharge', '75', 'Long carry surcharge per end when enabled'),
  ('public_domain', 'helloyugo.com', 'Public hostname for client quote links (no protocol); SMS and optional emails'),
  ('event_features', '[{"card":"Dedicated event crew","title":"Dedicated event crew","desc":"Same team handles delivery, setup, and return — they know the layout","iconName":"Users"},{"card":"All items inventoried","title":"All items inventoried and protected","desc":"Every piece documented, wrapped, and tracked","iconName":"ClipboardCheck"},{"card":"Floor & venue protection","title":"Floor and venue protection","desc":"Runners, corner guards, and surface protection at every location","iconName":"Home"},{"card":"Setup & arrangement","title":"On-site setup and arrangement","desc":"Furniture placed and arranged per your instructions","iconName":"Wrench"},{"card":"Post-event teardown","title":"Post-event teardown and return","desc":"Everything returned to origin in the same condition","iconName":"Package"},{"card":"Real-time coordination","title":"Real-time coordination","desc":"Live updates throughout delivery and return days","iconName":"MapPin"}]', 'JSON array: client quote ''Your Move Includes'' for event service type')
ON CONFLICT (key) DO NOTHING;
