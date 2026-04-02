-- B2B launch: cabinetry vertical, per-vertical item_config (quick-add + bundle rules), field_visibility,
-- and competitive base / tier rates. item_config.bundleRules drive pricing via application merge logic.

-- Mirror columns from 20260330210000_b2b_prompt4_completion; some remotes never received that migration.
ALTER TABLE public.delivery_verticals
  ADD COLUMN IF NOT EXISTS items_included_in_base INTEGER,
  ADD COLUMN IF NOT EXISTS per_item_rate_after_base NUMERIC(12, 2);

INSERT INTO public.delivery_verticals (
  code, name, description, icon, base_rate, pricing_method, default_config, sort_order, active,
  items_included_in_base, per_item_rate_after_base
) VALUES (
  'cabinetry',
  'Cabinetry & Fixtures',
  'Kitchen cabinets, vanities, countertops, closet systems',
  'Door',
  200,
  'dimensional',
  '{
    "unit_label": "piece",
    "unit_rate": 0,
    "items_included_in_base": 5,
    "per_item_rate_after_base": 35,
    "handling_rates": {"threshold": 0, "room_of_choice": 0, "white_glove": 0},
    "stop_rate": 55,
    "free_stops": 1,
    "truck_rates": {"sprinter": 0, "16ft": 50, "20ft": 100, "26ft": 150},
    "distance_mode": "zones",
    "distance_zones": [
      {"min_km": 0, "max_km": 40, "fee": 0},
      {"min_km": 40, "max_km": 80, "fee": 75},
      {"min_km": 80, "max_km": 9999, "fee": 150}
    ],
    "distance_free_km": 500,
    "distance_per_km": 0,
    "schedule_surcharges": {"weekend": 40, "after_hours": 60},
    "complexity_premiums": {"stairs_per_flight": 35, "fragile_countertop": 75},
    "weight_line_rates": {"light": 0, "medium": 25, "heavy": 50, "extra_heavy": 100},
    "field_visibility": {
      "show": ["handling", "debris_removal", "multi_stop", "stairs"],
      "hide": ["box_count", "skid_count", "chain_of_custody", "hookup", "returns", "haul_away", "same_day", "artwork", "antiques", "time_sensitive"],
      "defaultHandling": "room_of_choice",
      "defaultCrew": 2,
      "multiStopDefault": false
    },
    "item_config": {
      "label": "Cabinetry & Fixtures",
      "quickAdd": [
        {"name": "Upper cabinet", "weight": "heavy"},
        {"name": "Lower / base cabinet", "weight": "extra_heavy"},
        {"name": "Pantry / tall cabinet", "weight": "extra_heavy"},
        {"name": "Vanity", "weight": "heavy"},
        {"name": "Countertop slab", "weight": "extra_heavy", "fragile": true},
        {"name": "Island unit", "weight": "extra_heavy"},
        {"name": "Custom item", "weight": "medium"}
      ],
      "showFields": ["description", "quantity", "weight", "fragile"],
      "bundleRules": {
        "freeAccessories": ["Hardware box", "Filler strips / trim", "Doors / drawer fronts"],
        "includedQuantity": 5,
        "perPieceAfter": 35
      }
    }
  }'::jsonb,
  35,
  true,
  5,
  35
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  base_rate = EXCLUDED.base_rate,
  pricing_method = EXCLUDED.pricing_method,
  default_config = EXCLUDED.default_config,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active,
  items_included_in_base = EXCLUDED.items_included_in_base,
  per_item_rate_after_base = EXCLUDED.per_item_rate_after_base;

-- furniture_retail
UPDATE public.delivery_verticals SET
  base_rate = 175,
  items_included_in_base = 3,
  per_item_rate_after_base = 35,
  default_config = COALESCE(default_config, '{}'::jsonb)
    || '{"field_visibility":{"show":["handling","assembly","debris_removal","multi_stop","stairs","time_sensitive"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup","returns","haul_away","same_day","artwork","antiques"],"defaultHandling":"threshold","defaultCrew":2,"multiStopDefault":false}}'::jsonb
    || '{"item_config":{"label":"Furniture & Bedding","quickAdd":[{"name":"Sofa / Sectional","weight":"heavy"},{"name":"Sectional (modular)","weight":"heavy"},{"name":"Loveseat","weight":"heavy"},{"name":"Dining Table","weight":"heavy"},{"name":"Dining Chair","weight":"light"},{"name":"Bed Frame","weight":"heavy"},{"name":"Mattress / Foundation","weight":"medium"},{"name":"Dresser","weight":"heavy"},{"name":"Nightstand","weight":"medium"},{"name":"Coffee Table","weight":"medium"},{"name":"Accent Chair","weight":"medium"},{"name":"TV Stand","weight":"medium"},{"name":"Custom item","weight":"medium"}],"showFields":["description","quantity","weight","fragile"],"bundleRules":{"freeAccessories":["Throw pillows / cushions","Hardware kit","Felt pads / glides","Remote / batteries kit"],"includedQuantity":3,"perPieceAfter":35}}}'::jsonb
WHERE code = 'furniture_retail';

-- flooring
UPDATE public.delivery_verticals SET
  base_rate = 150,
  items_included_in_base = 50,
  per_item_rate_after_base = 1,
  default_config = COALESCE(default_config, '{}'::jsonb)
    || '{"field_visibility":{"show":["handling","skid_count","total_weight","box_count","multi_stop","stairs"],"hide":["assembly","chain_of_custody","hookup","returns","haul_away","same_day","artwork","antiques","time_sensitive","debris_removal","high_value"],"defaultHandling":"hand_bomb","defaultCrew":2,"multiStopDefault":false}}'::jsonb
    || '{"item_config":{"label":"Flooring & Materials","quickAdd":[{"name":"Hardwood (boxes)","weight":"medium","unit":"box"},{"name":"Laminate (boxes)","weight":"light","unit":"box"},{"name":"Vinyl plank (boxes)","weight":"light","unit":"box"},{"name":"Tile (boxes)","weight":"heavy","unit":"box"},{"name":"Carpet (roll)","weight":"heavy","unit":"roll"},{"name":"Underlayment (roll)","weight":"light","unit":"roll"},{"name":"Transition / T-mould","weight":"light","unit":"piece"},{"name":"Reducer","weight":"light","unit":"piece"},{"name":"Quarter round / trim","weight":"light","unit":"piece"},{"name":"Nosing","weight":"light","unit":"piece"},{"name":"Adhesive / mortar","weight":"heavy","unit":"bag"},{"name":"Custom item","weight":"medium","unit":"piece"}],"showFields":["description","quantity","weight","unit_type"],"bundleRules":{"freeAccessories":["T-moulds","Reducers","Quarter round / trim","Nosing"],"includedQuantity":50,"perUnitAfter":1}}}'::jsonb
WHERE code = 'flooring';

-- designer
UPDATE public.delivery_verticals SET
  base_rate = 250,
  items_included_in_base = 5,
  per_item_rate_after_base = 20,
  default_config = COALESCE(default_config, '{}'::jsonb)
    || '{"field_visibility":{"show":["handling","assembly","debris_removal","artwork","high_value","time_sensitive","multi_stop","stairs"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup","returns","haul_away","same_day","antiques"],"defaultHandling":"white_glove","defaultCrew":2,"multiStopDefault":true}}'::jsonb
    || '{"item_config":{"label":"Design Project Items","quickAdd":[{"name":"Sofa / Sectional","weight":"heavy"},{"name":"Accent Chair","weight":"medium"},{"name":"Ottoman","weight":"medium"},{"name":"Dining Table","weight":"heavy"},{"name":"Dining Chair","weight":"light"},{"name":"Coffee Table","weight":"medium"},{"name":"Side Table","weight":"light"},{"name":"Console","weight":"medium"},{"name":"Area Rug","weight":"medium"},{"name":"Rug Pad","weight":"light"},{"name":"Artwork / Frame","weight":"light","fragile":true},{"name":"Mirror","weight":"medium","fragile":true},{"name":"Lamp / Lighting","weight":"light","fragile":true},{"name":"Cushion / Throw","weight":"light"},{"name":"Decorative Object","weight":"light"},{"name":"Television","weight":"medium"},{"name":"TV Mount / Bracket","weight":"light"},{"name":"Custom item","weight":"medium"}],"showFields":["description","quantity","weight","fragile"],"bundleRules":{"freeAccessories":["Cushion / Throw","Rug Pad","TV Mount / Bracket","Decorative Object","Hardware kit","Legs / feet"],"includedQuantity":5,"perPieceAfter":20}}}'::jsonb
WHERE code = 'designer';

-- medical_equipment
UPDATE public.delivery_verticals SET
  base_rate = 350,
  items_included_in_base = 1,
  per_item_rate_after_base = 75,
  default_config = COALESCE(default_config, '{}'::jsonb)
    || '{"field_visibility":{"show":["handling","chain_of_custody","high_value","multi_stop","stairs","time_sensitive"],"hide":["box_count","skid_count","total_weight","hookup","returns","haul_away","same_day","assembly","debris_removal","artwork","antiques"],"defaultHandling":"white_glove","defaultCrew":2,"multiStopDefault":false}}'::jsonb
    || '{"item_config":{"label":"Medical Equipment","quickAdd":[{"name":"Ultrasound machine","weight":"heavy"},{"name":"Exam table","weight":"extra_heavy"},{"name":"Dental chair","weight":"extra_heavy"},{"name":"X-ray unit","weight":"heavy","fragile":true},{"name":"Lab instrument","weight":"medium","fragile":true},{"name":"Monitor / display","weight":"medium","fragile":true},{"name":"Medical cart","weight":"medium"},{"name":"Sterilization unit","weight":"heavy"},{"name":"Custom item","weight":"medium"}],"showFields":["description","quantity","weight","fragile"],"bundleRules":{"includedQuantity":1,"perPieceAfter":75}}}'::jsonb
WHERE code = 'medical_equipment';

-- appliance
UPDATE public.delivery_verticals SET
  base_rate = 175,
  items_included_in_base = 1,
  per_item_rate_after_base = 50,
  default_config = COALESCE(default_config, '{}'::jsonb)
    || '{"field_visibility":{"show":["handling","hookup","haul_away","multi_stop","stairs","time_sensitive"],"hide":["box_count","skid_count","total_weight","chain_of_custody","returns","same_day","assembly","debris_removal","artwork","antiques"],"defaultHandling":"room_of_choice","defaultCrew":2,"multiStopDefault":false}}'::jsonb
    || '{"item_config":{"label":"Appliances","quickAdd":[{"name":"Refrigerator","weight":"extra_heavy"},{"name":"Washer","weight":"extra_heavy"},{"name":"Dryer","weight":"extra_heavy"},{"name":"Dishwasher","weight":"heavy"},{"name":"Stove / Range","weight":"extra_heavy"},{"name":"Microwave","weight":"medium"},{"name":"Wine cooler","weight":"heavy"},{"name":"Freezer","weight":"extra_heavy"},{"name":"Custom item","weight":"heavy"}],"showFields":["description","quantity","weight"],"bundleRules":{"includedQuantity":1,"perPieceAfter":50}}}'::jsonb
WHERE code = 'appliance';

-- art_gallery
UPDATE public.delivery_verticals SET
  base_rate = 250,
  items_included_in_base = 3,
  per_item_rate_after_base = 40,
  default_config = COALESCE(default_config, '{}'::jsonb)
    || '{"field_visibility":{"show":["handling","artwork","high_value","multi_stop","stairs","time_sensitive"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup","returns","haul_away","same_day","debris_removal","antiques"],"defaultHandling":"white_glove","defaultCrew":2,"multiStopDefault":true}}'::jsonb
    || '{"item_config":{"label":"Art & Gallery Pieces","quickAdd":[{"name":"Painting (small <24\")","weight":"light","fragile":true},{"name":"Painting (medium 24-48\")","weight":"medium","fragile":true},{"name":"Painting (large 48\"+)","weight":"medium","fragile":true},{"name":"Sculpture","weight":"heavy","fragile":true},{"name":"Framed photograph","weight":"light","fragile":true},{"name":"Print / lithograph","weight":"light","fragile":true},{"name":"Installation piece","weight":"heavy"},{"name":"Pedestal / display","weight":"medium"},{"name":"Custom item","weight":"medium","fragile":true}],"showFields":["description","quantity","weight","fragile"],"bundleRules":{"includedQuantity":3,"perPieceAfter":40}}}'::jsonb
WHERE code = 'art_gallery';

-- restaurant_hospitality
UPDATE public.delivery_verticals SET
  base_rate = 175,
  items_included_in_base = 5,
  per_item_rate_after_base = 20,
  default_config = COALESCE(default_config, '{}'::jsonb)
    || '{"field_visibility":{"show":["handling","assembly","multi_stop","stairs","debris_removal","time_sensitive"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup","returns","haul_away","artwork","antiques"],"defaultHandling":"threshold","defaultCrew":2,"multiStopDefault":false}}'::jsonb
    || '{"item_config":{"label":"Restaurant & Hospitality","quickAdd":[{"name":"Table","weight":"heavy"},{"name":"Chair","weight":"light"},{"name":"Booth / banquette","weight":"extra_heavy"},{"name":"Bar stool","weight":"light"},{"name":"POS system","weight":"medium","fragile":true},{"name":"Display case","weight":"heavy","fragile":true},{"name":"Kitchen equipment","weight":"extra_heavy"},{"name":"Signage","weight":"medium"},{"name":"Custom item","weight":"medium"}],"showFields":["description","quantity","weight","fragile"],"bundleRules":{"freeWith":{"Chair":["Table"],"Bar stool":["Table"]},"freeRatio":6,"includedQuantity":5,"perPieceAfter":20}}}'::jsonb
WHERE code = 'restaurant_hospitality';

-- ecommerce_bulk
UPDATE public.delivery_verticals SET
  base_rate = 150,
  items_included_in_base = 10,
  per_item_rate_after_base = 10,
  default_config = COALESCE(default_config, '{}'::jsonb)
    || '{"field_visibility":{"show":["handling","returns","same_day","multi_stop","box_count","stairs","time_sensitive"],"hide":["skid_count","total_weight","chain_of_custody","hookup","haul_away","assembly","artwork","antiques","debris_removal","high_value"],"defaultHandling":"threshold","defaultCrew":1,"multiStopDefault":true}}'::jsonb
    || '{"item_config":{"label":"E-Commerce Parcels","quickAdd":[{"name":"Small parcel","weight":"light"},{"name":"Medium parcel","weight":"medium"},{"name":"Large parcel","weight":"heavy"},{"name":"Oversized item","weight":"extra_heavy"},{"name":"Custom item","weight":"medium"}],"showFields":["description","quantity","weight"],"bundleRules":{"includedQuantity":10,"perPieceAfter":10}}}'::jsonb
WHERE code = 'ecommerce_bulk';

-- custom
UPDATE public.delivery_verticals SET
  base_rate = 200,
  items_included_in_base = 3,
  per_item_rate_after_base = 30,
  default_config = COALESCE(default_config, '{}'::jsonb)
    || '{"field_visibility":{"show":["handling","assembly","debris_removal","multi_stop","stairs","time_sensitive"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup","returns","haul_away","same_day","artwork","antiques"],"defaultHandling":"threshold","defaultCrew":2,"multiStopDefault":false}}'::jsonb
    || '{"item_config":{"label":"Items","quickAdd":[{"name":"Custom item","weight":"medium"}],"showFields":["description","quantity","weight","fragile"],"bundleRules":{"includedQuantity":3,"perPieceAfter":30}}}'::jsonb
WHERE code = 'custom';
