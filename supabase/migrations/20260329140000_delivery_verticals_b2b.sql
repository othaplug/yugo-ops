-- B2B dimensional pricing: configurable delivery verticals + per-partner overrides

CREATE TABLE IF NOT EXISTS public.delivery_verticals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  base_rate NUMERIC NOT NULL DEFAULT 350,
  pricing_method TEXT NOT NULL DEFAULT 'dimensional' CHECK (pricing_method IN (
    'flat',
    'per_item',
    'per_unit',
    'hourly',
    'dimensional'
  )),
  default_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_verticals_active_sort
  ON public.delivery_verticals (active, sort_order);

CREATE TABLE IF NOT EXISTS public.partner_vertical_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vertical_code TEXT NOT NULL REFERENCES public.delivery_verticals(code) ON UPDATE CASCADE ON DELETE CASCADE,
  custom_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, vertical_code)
);

CREATE INDEX IF NOT EXISTS idx_partner_vertical_rates_org
  ON public.partner_vertical_rates (organization_id);

ALTER TABLE public.delivery_verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_vertical_rates ENABLE ROW LEVEL SECURITY;

-- No policies: accessed only via service role (admin API routes)

INSERT INTO public.delivery_verticals (code, name, description, icon, base_rate, pricing_method, default_config, sort_order) VALUES
(
  'furniture_retail',
  'Furniture Retail Delivery',
  'Sofas, tables, beds from retail stores to homes',
  'Armchair',
  350,
  'dimensional',
  '{"unit_label":"piece","unit_rate":50,"handling_rates":{"dock_to_dock":0,"threshold":75,"room_of_choice":125,"white_glove":200,"hand_bomb":0},"crew_hourly_rate":75,"min_crew":2,"min_hours":2,"stop_rate":100,"free_stops":1,"truck_rates":{"sprinter":0,"16ft":50,"20ft":100,"26ft":150},"distance_free_km":20,"distance_per_km":3,"complexity_premiums":{"time_sensitive":100,"fragile":75,"assembly_required":85,"debris_removal":40,"stairs_per_flight":60}}'::jsonb,
  10
),
(
  'flooring',
  'Flooring / Building Materials',
  'Boxes of flooring, tile, trim, T-moulds',
  'Package',
  250,
  'per_unit',
  '{"unit_label":"box","unit_rate":1.50,"min_charge":250,"handling_rates":{"skid_drop":0,"hand_bomb_per_box":1.50,"carry_in_per_box":2.50,"room_placement":3.50},"weight_tiers":{"light_under_30lbs":0,"medium_30_60lbs":0.50,"heavy_over_60lbs":1.00},"crew_hourly_rate":75,"min_crew":2,"stop_rate":75,"free_stops":1,"truck_rates":{"sprinter":0,"16ft":50,"20ft":100,"26ft":150},"distance_free_km":20,"distance_per_km":3}'::jsonb,
  20
),
(
  'designer',
  'Interior Designer Projects',
  'Multi-stop pickups from vendors, delivery to client',
  'Palette',
  450,
  'dimensional',
  '{"unit_label":"piece","unit_rate":40,"handling_rates":{"threshold":100,"room_of_choice":150,"white_glove":225},"crew_hourly_rate":85,"min_crew":2,"stop_rate":125,"free_stops":1,"truck_rates":{"sprinter":0,"16ft":75,"20ft":125,"26ft":175},"distance_free_km":15,"distance_per_km":3.50,"complexity_premiums":{"time_sensitive":150,"fragile":75,"assembly_required":100,"debris_removal":50,"tv_mounting":99}}'::jsonb,
  30
),
(
  'medical_equipment',
  'Medical / Lab Equipment',
  'Ultrasound machines, exam tables, lab instruments',
  'Heartbeat',
  500,
  'dimensional',
  '{"unit_label":"unit","unit_rate":100,"handling_rates":{"dock_to_dock":0,"threshold":150,"room_of_choice":250,"white_glove":400},"crew_hourly_rate":95,"min_crew":2,"min_hours":3,"stop_rate":150,"free_stops":1,"truck_rates":{"sprinter":75,"16ft":125,"20ft":175,"26ft":225},"distance_free_km":15,"distance_per_km":4,"complexity_premiums":{"time_sensitive":200,"fragile":150,"calibration_required":300,"elevator_required":0,"stairs_per_flight":100}}'::jsonb,
  40
),
(
  'appliance',
  'Appliance Delivery',
  'Fridges, washers, stoves from retailers',
  'WashingMachine',
  300,
  'dimensional',
  '{"unit_label":"appliance","unit_rate":75,"handling_rates":{"threshold":50,"room_of_choice":100,"hookup":95},"crew_hourly_rate":75,"min_crew":2,"min_hours":1.5,"stop_rate":75,"free_stops":1,"truck_rates":{"sprinter":0,"16ft":50,"20ft":100},"distance_free_km":20,"distance_per_km":3,"complexity_premiums":{"haul_away_old":50,"disconnect_old":45,"stairs_per_flight":75}}'::jsonb,
  50
),
(
  'art_gallery',
  'Art & Gallery',
  'Paintings, sculptures, installations',
  'FrameCorners',
  400,
  'dimensional',
  '{"unit_label":"piece","unit_rate":60,"handling_rates":{"white_glove":200,"custom_crate":175},"crew_hourly_rate":90,"min_crew":2,"min_hours":2,"stop_rate":125,"free_stops":1,"truck_rates":{"sprinter":50,"16ft":100,"20ft":150},"distance_free_km":15,"distance_per_km":4,"complexity_premiums":{"time_sensitive":150,"climate_controlled":100,"insurance_premium":200}}'::jsonb,
  60
),
(
  'restaurant_hospitality',
  'Restaurant / Hospitality',
  'Kitchen equipment, furniture, POS systems',
  'CookingPot',
  350,
  'dimensional',
  '{"unit_label":"piece","unit_rate":35,"handling_rates":{"dock_to_dock":0,"threshold":75,"room_of_choice":125},"crew_hourly_rate":80,"min_crew":2,"stop_rate":100,"free_stops":1,"truck_rates":{"16ft":50,"20ft":100,"26ft":150},"distance_free_km":20,"distance_per_km":3,"complexity_premiums":{"after_hours":0.20,"stairs_per_flight":60}}'::jsonb,
  70
),
(
  'office_furniture',
  'Office / Commercial Furniture',
  'Desks, chairs, filing cabinets, cubicles',
  'OfficeChair',
  350,
  'per_unit',
  '{"unit_label":"piece","unit_rate":30,"min_charge":350,"handling_rates":{"dock_to_dock":0,"room_of_choice":50,"assembly":45},"crew_hourly_rate":75,"min_crew":2,"truck_rates":{"16ft":50,"20ft":100,"26ft":150},"distance_free_km":20,"distance_per_km":3}'::jsonb,
  80
),
(
  'ecommerce_bulk',
  'E-Commerce / Bulk Delivery',
  'Multiple parcels, multi-stop route delivery',
  'Truck',
  300,
  'per_unit',
  '{"unit_label":"parcel","unit_rate":15,"min_charge":300,"stop_rate":25,"free_stops":3,"crew_hourly_rate":65,"min_crew":1,"truck_rates":{"sprinter":0,"16ft":50},"distance_free_km":30,"distance_per_km":2}'::jsonb,
  90
),
(
  'custom',
  'Custom / Other',
  'Any delivery not covered by standard verticals',
  'Gear',
  350,
  'dimensional',
  '{"unit_label":"item","unit_rate":40,"handling_rates":{"threshold":75,"room_of_choice":125,"white_glove":200},"crew_hourly_rate":80,"min_crew":2,"stop_rate":100,"free_stops":1,"truck_rates":{"sprinter":0,"16ft":50,"20ft":100,"26ft":150},"distance_free_km":15,"distance_per_km":3}'::jsonb,
  100
)
ON CONFLICT (code) DO NOTHING;
