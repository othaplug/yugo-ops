-- B2B vertical pricing recalibration (Mar 2026). Table: delivery_verticals (not b2b_vertical_configs).
-- Remove Office vertical — commercial office moves use Commercial/Office Move service type.

DELETE FROM public.partner_vertical_rates WHERE vertical_code = 'office_furniture';
DELETE FROM public.delivery_verticals WHERE code = 'office_furniture';

INSERT INTO public.platform_config (key, value, description)
SELECT
  'b2b_accessories_excluded_from_count',
  '["Throw cushions / accent pillows","Brackets, hardware bags, mounting kits","Rug pads / underlayment","Furniture legs (shipped separately)","Shelf inserts / drawer organizers","Glass shelves (for display units)","Felt pads / floor protectors","Cable management kits","Assembly instruction packets","Fabric samples / swatches"]',
  'JSON array: item types never counted as billable B2B pieces (coordinator reference; editable in platform settings).'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_config WHERE key = 'b2b_accessories_excluded_from_count');

-- Furniture Retail
UPDATE public.delivery_verticals SET
  base_rate = 249,
  sort_order = 10,
  default_config = '{
    "unit_label": "piece",
    "unit_rate": 0,
    "items_included_in_base": 3,
    "per_item_rate_after_base": 35,
    "assembly_included": true,
    "handling_rates": {"threshold": -50, "dock_to_dock": -50, "room_of_choice": 0, "white_glove": 0, "hand_bomb": 0},
    "stop_rate": 55,
    "free_stops": 1,
    "sprinter_max_units": 6,
    "truck_rates": {"sprinter": 0, "16ft": 0, "20ft": 75, "26ft": 125},
    "minimum_truck": null,
    "distance_mode": "zones",
    "distance_zones": [{"min_km": 0, "max_km": 40, "fee": 0}, {"min_km": 40, "max_km": 80, "fee": 75}, {"min_km": 80, "max_km": 9999, "fee": 150}],
    "distance_free_km": 500,
    "distance_per_km": 0,
    "schedule_surcharges": {"weekend": 40, "after_hours": 60},
    "waive_after_hours_surcharge": false,
    "complexity_premiums": {"stairs_per_flight": 35, "time_sensitive": 0, "fragile": 0, "assembly_required": 0, "debris_removal": 0},
    "weight_line_rates": {"light": 0, "medium": 25, "heavy": 50, "extra_heavy": 100},
    "extra_heavy_labour": {"extra_crew": 1, "hourly_per_extra": 84, "min_hours": 2},
    "volume_discount_tiers": [{"min_monthly_deliveries": 10, "percent_off": 10}, {"min_monthly_deliveries": 20, "percent_off": 15}, {"min_monthly_deliveries": 30, "percent_off": 20}]
  }'::jsonb
WHERE code = 'furniture_retail';

-- Interior Design
UPDATE public.delivery_verticals SET
  base_rate = 299,
  sort_order = 30,
  default_config = '{
    "unit_label": "piece",
    "unit_rate": 0,
    "items_included_in_base": 5,
    "per_item_rate_after_base": 30,
    "assembly_included": true,
    "handling_rates": {"threshold": -50, "room_of_choice": 0, "white_glove": 0},
    "stop_rate": 55,
    "free_stops": 2,
    "sprinter_max_units": 5,
    "truck_rates": {"sprinter": 0, "16ft": 75, "20ft": 125, "26ft": 175},
    "distance_mode": "zones",
    "distance_zones": [{"min_km": 0, "max_km": 40, "fee": 0}, {"min_km": 40, "max_km": 80, "fee": 75}, {"min_km": 80, "max_km": 9999, "fee": 150}],
    "distance_free_km": 500,
    "distance_per_km": 0,
    "schedule_surcharges": {"weekend": 40, "after_hours": 60},
    "waive_after_hours_surcharge": false,
    "complexity_premiums": {"stairs_per_flight": 35, "time_sensitive": 0, "fragile": 0, "assembly_required": 0, "debris_removal": 0, "tv_mounting": 99},
    "weight_line_rates": {"light": 0, "medium": 25, "heavy": 50, "extra_heavy": 100},
    "extra_heavy_labour": {"extra_crew": 1, "hourly_per_extra": 84, "min_hours": 2},
    "large_job_min_crew": 3,
    "large_job_item_threshold": 12,
    "volume_discount_tiers": [{"min_monthly_deliveries": 5, "percent_off": 10}, {"min_monthly_deliveries": 10, "percent_off": 15}]
  }'::jsonb
WHERE code = 'designer';

-- Flooring
UPDATE public.delivery_verticals SET
  base_rate = 179,
  pricing_method = 'per_unit',
  sort_order = 20,
  default_config = '{
    "unit_label": "box",
    "unit_rate": 0,
    "items_included_in_base": 30,
    "per_item_rate_after_base": 1.25,
    "assembly_included": false,
    "skid_handling_fee": 35,
    "handling_rates": {"skid_drop": 0, "hand_bomb_per_box": 0, "carry_in_per_box": 0, "room_placement": 0, "threshold": 0, "room_of_choice": 0},
    "stop_rate": 55,
    "free_stops": 1,
    "sprinter_max_units": 999,
    "minimum_truck": "16ft",
    "truck_rates": {"sprinter": 50, "16ft": 0, "20ft": 50, "26ft": 100},
    "distance_mode": "zones",
    "distance_zones": [{"min_km": 0, "max_km": 40, "fee": 0}, {"min_km": 40, "max_km": 80, "fee": 75}, {"min_km": 80, "max_km": 9999, "fee": 150}],
    "distance_free_km": 500,
    "distance_per_km": 0,
    "schedule_surcharges": {"weekend": 40, "after_hours": 60},
    "waive_after_hours_surcharge": false,
    "complexity_premiums": {"stairs_per_flight": 35},
    "flooring_load_tiers": {"standard_max_lb": 1000, "heavy_max_lb": 2500, "heavy_fee": 40, "extra_fee": 80, "extra_three_crew": true},
    "volume_discount_tiers": [{"min_monthly_deliveries": 15, "percent_off": 15}, {"min_monthly_deliveries": 30, "percent_off": 20}]
  }'::jsonb
WHERE code = 'flooring';

-- Art / Gallery
UPDATE public.delivery_verticals SET
  base_rate = 299,
  sort_order = 60,
  default_config = '{
    "unit_label": "piece",
    "unit_rate": 0,
    "items_included_in_base": 2,
    "per_item_rate_after_base": 45,
    "assembly_included": false,
    "handling_rates": {"threshold": 0, "room_of_choice": 0, "white_glove": 0},
    "stop_rate": 55,
    "free_stops": 1,
    "truck_rates": {"sprinter": 0, "16ft": 50, "20ft": 100},
    "distance_mode": "zones",
    "distance_zones": [{"min_km": 0, "max_km": 40, "fee": 0}, {"min_km": 40, "max_km": 80, "fee": 75}, {"min_km": 80, "max_km": 9999, "fee": 150}],
    "distance_free_km": 500,
    "distance_per_km": 0,
    "schedule_surcharges": {"weekend": 40, "after_hours": 60},
    "waive_after_hours_surcharge": false,
    "complexity_premiums": {"stairs_per_flight": 35, "time_sensitive": 0, "fragile": 0},
    "weight_line_rates": {"light": 0, "medium": 25, "heavy": 50, "extra_heavy": 100},
    "extra_heavy_labour": {"extra_crew": 1, "hourly_per_extra": 84, "min_hours": 2}
  }'::jsonb
WHERE code = 'art_gallery';

-- Medical
UPDATE public.delivery_verticals SET
  base_rate = 449,
  sort_order = 40,
  default_config = '{
    "unit_label": "unit",
    "unit_rate": 0,
    "items_included_in_base": 1,
    "per_item_rate_after_base": 175,
    "assembly_included": false,
    "handling_rates": {"dock_to_dock": 0, "threshold": 0, "room_of_choice": 0, "white_glove": 0},
    "stop_rate": 55,
    "free_stops": 1,
    "truck_rates": {"sprinter": 0, "16ft": 50, "20ft": 100, "26ft": 150},
    "distance_mode": "zones",
    "distance_zones": [{"min_km": 0, "max_km": 40, "fee": 0}, {"min_km": 40, "max_km": 80, "fee": 75}, {"min_km": 80, "max_km": 9999, "fee": 150}],
    "distance_free_km": 500,
    "distance_per_km": 0,
    "schedule_surcharges": {"weekend_or_after_hours_combined": 125},
    "waive_after_hours_surcharge": false,
    "complexity_premiums": {"stairs_per_flight": 50, "time_sensitive": 0, "fragile": 0},
    "weight_line_rates": {"light": 0, "medium": 75, "heavy": 150, "extra_heavy": 150},
    "extra_heavy_labour": {"extra_crew": 1, "hourly_per_extra": 95, "min_hours": 3},
    "medical_combined_schedule_surcharge": true
  }'::jsonb
WHERE code = 'medical_equipment';

-- Appliance
UPDATE public.delivery_verticals SET
  base_rate = 249,
  sort_order = 50,
  default_config = '{
    "unit_label": "appliance",
    "unit_rate": 0,
    "items_included_in_base": 1,
    "per_item_rate_after_base": 75,
    "assembly_included": false,
    "handling_rates": {"threshold": 0, "room_of_choice": 0, "hookup": 0},
    "stop_rate": 55,
    "free_stops": 1,
    "truck_rates": {"sprinter": 0, "16ft": 0, "20ft": 50},
    "distance_mode": "zones",
    "distance_zones": [{"min_km": 0, "max_km": 40, "fee": 0}, {"min_km": 40, "max_km": 80, "fee": 75}, {"min_km": 80, "max_km": 9999, "fee": 150}],
    "distance_free_km": 500,
    "distance_per_km": 0,
    "schedule_surcharges": {"weekend": 40, "after_hours": 60},
    "waive_after_hours_surcharge": false,
    "complexity_premiums": {"stairs_per_flight": 45, "haul_away_old": 95},
    "weight_line_rates": {"light": 0, "medium": 35, "heavy": 75, "extra_heavy": 75},
    "haul_away_per_unit": 95
  }'::jsonb
WHERE code = 'appliance';

-- Restaurant / Hospitality
UPDATE public.delivery_verticals SET
  base_rate = 349,
  sort_order = 70,
  default_config = '{
    "unit_label": "piece",
    "unit_rate": 0,
    "items_included_in_base": 5,
    "per_item_rate_after_base": 25,
    "assembly_included": true,
    "handling_rates": {"dock_to_dock": 0, "threshold": 0, "room_of_choice": 0},
    "stop_rate": 55,
    "free_stops": 1,
    "truck_rates": {"sprinter": 0, "16ft": 50, "20ft": 100, "26ft": 150},
    "distance_mode": "zones",
    "distance_zones": [{"min_km": 0, "max_km": 40, "fee": 0}, {"min_km": 40, "max_km": 80, "fee": 75}, {"min_km": 80, "max_km": 9999, "fee": 150}],
    "distance_free_km": 500,
    "distance_per_km": 0,
    "schedule_surcharges": {"weekend": 40, "after_hours": 0},
    "waive_after_hours_surcharge": true,
    "complexity_premiums": {"stairs_per_flight": 35},
    "weight_line_rates": {"light": 0, "medium": 40, "heavy": 100, "extra_heavy": 100},
    "large_job_min_crew": 3,
    "large_job_item_threshold": 15,
    "volume_discount_tiers": [{"min_monthly_deliveries": 5, "percent_off": 10}, {"min_monthly_deliveries": 10, "percent_off": 15}]
  }'::jsonb
WHERE code = 'restaurant_hospitality';

-- E-Commerce
UPDATE public.delivery_verticals SET
  base_rate = 149,
  pricing_method = 'per_unit',
  sort_order = 90,
  default_config = '{
    "unit_label": "parcel",
    "unit_rate": 0,
    "items_included_in_base": 3,
    "per_item_rate_after_base": 15,
    "assembly_included": false,
    "assembly_addon_flat": 50,
    "handling_rates": {"threshold": 0, "room_of_choice": 0},
    "stop_rate": 55,
    "free_stops": 1,
    "truck_rates": {"sprinter": 0, "16ft": 50},
    "distance_mode": "zones",
    "distance_zones": [{"min_km": 0, "max_km": 40, "fee": 0}, {"min_km": 40, "max_km": 80, "fee": 75}, {"min_km": 80, "max_km": 9999, "fee": 150}],
    "distance_free_km": 500,
    "distance_per_km": 0,
    "schedule_surcharges": {"weekend": 40, "after_hours": 60, "same_day": 60},
    "waive_after_hours_surcharge": false,
    "complexity_premiums": {"stairs_per_flight": 35},
    "weight_line_rates": {"light": 0, "medium": 20, "heavy": 45, "extra_heavy": 45},
    "returns_pickup_flat": 85,
    "volume_discount_tiers": [{"min_monthly_deliveries": 50, "percent_off": 20}, {"min_monthly_deliveries": 100, "percent_off": 25}]
  }'::jsonb
WHERE code = 'ecommerce_bulk';

-- Custom / Specialty — coordinator manual scope; list price is a floor only
UPDATE public.delivery_verticals SET
  base_rate = 400,
  sort_order = 100,
  pricing_method = 'flat',
  default_config = '{
    "unit_label": "item",
    "unit_rate": 0,
    "auto_quote_disabled": true,
    "target_margin_percent_default": 40,
    "handling_rates": {},
    "stop_rate": 55,
    "free_stops": 1,
    "truck_rates": {"sprinter": 0, "16ft": 50, "20ft": 100, "26ft": 150},
    "distance_free_km": 15,
    "distance_per_km": 3,
    "complexity_premiums": {}
  }'::jsonb
WHERE code = 'custom';
