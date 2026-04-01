-- Definitive B2B matrix: item_config (labels, quickAdd w/ optional icon, showFields, bundleRules),
-- field_visibility per launch spec, base/tier columns. Supersedes prior item_config/field_visibility seeds.
-- DB codes: medical_equipment, ecommerce_bulk (not medical / ecommerce).

-- furniture_retail — freeWith bundle, $25 overage, Phosphor icon keys on quickAdd
UPDATE public.delivery_verticals SET
  base_rate = 175,
  items_included_in_base = 3,
  per_item_rate_after_base = 25,
  default_config = (COALESCE(default_config, '{}'::jsonb) - 'item_config' - 'field_visibility')
    || jsonb_build_object(
      'field_visibility',
      '{"show":["handling","assembly","debris_removal"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup_install","returns","haul_away","same_day","artwork","antiques"],"defaultHandling":"threshold","defaultCrew":2,"multiStopDefault":false}'::jsonb,
      'item_config',
      $ic_furniture$
{"label":"Furniture Items","quickAdd":[
{"name":"Sofa / Sectional","weight":"heavy","icon":"Armchair"},
{"name":"Dining Table","weight":"heavy","icon":"Table"},
{"name":"Dining Chairs","weight":"light","icon":"Chair"},
{"name":"Bed Frame","weight":"heavy","icon":"Bed"},
{"name":"Mattress","weight":"heavy","icon":"Bed"},
{"name":"Dresser","weight":"heavy","icon":"Dresser"},
{"name":"Nightstand","weight":"medium","icon":"Nightstand"},
{"name":"Coffee Table","weight":"medium","icon":"Table"},
{"name":"Bookshelf","weight":"medium","icon":"Bookshelf"},
{"name":"TV Stand","weight":"medium","icon":"Television"},
{"name":"Ottoman","weight":"medium","icon":"Armchair"},
{"name":"Accent Chair","weight":"medium","icon":"Chair"},
{"name":"Desk","weight":"heavy","icon":"Desk"},
{"name":"Console Table","weight":"medium","icon":"Table"},
{"name":"Bar Stool","weight":"light","icon":"Chair"},
{"name":"Cushion","weight":"light","icon":"Armchair"},
{"name":"Custom item","weight":"medium","icon":"Package"}
],"showFields":["description","quantity","weight","fragile"],"bundleRules":{"freeWith":{"Cushion":["Sofa / Sectional","Accent Chair","Ottoman"],"Hardware kit":["Bed Frame","Bookshelf","Desk"],"Legs / feet":["Sofa / Sectional","Coffee Table"]},"includedQuantity":3,"perPieceAfter":25}}
$ic_furniture$::jsonb
    )
WHERE code = 'furniture_retail';

-- flooring
UPDATE public.delivery_verticals SET
  base_rate = 150,
  items_included_in_base = 50,
  per_item_rate_after_base = 1,
  default_config = (COALESCE(default_config, '{}'::jsonb) - 'item_config' - 'field_visibility')
    || jsonb_build_object(
      'field_visibility',
      '{"show":["handling","skid_count","total_weight","box_count"],"hide":["assembly","chain_of_custody","hookup_install","returns","haul_away","same_day","artwork","antiques","time_sensitive","debris_removal","high_value","stairs","multi_stop"],"defaultHandling":"hand_bomb","defaultCrew":2,"multiStopDefault":false}'::jsonb,
      'item_config',
      $ic_flooring$
{"label":"Flooring Materials","quickAdd":[
{"name":"Hardwood boxes","weight":"heavy","unit":"box"},
{"name":"Laminate boxes","weight":"medium","unit":"box"},
{"name":"Vinyl plank boxes","weight":"medium","unit":"box"},
{"name":"Tile boxes","weight":"heavy","unit":"box"},
{"name":"Vinyl rolls","weight":"heavy","unit":"roll"},
{"name":"Carpet rolls","weight":"heavy","unit":"roll"},
{"name":"Underlayment rolls","weight":"light","unit":"roll"},
{"name":"T-moulds","weight":"light","unit":"piece"},
{"name":"Reducers","weight":"light","unit":"piece"},
{"name":"Quarter round / trim","weight":"light","unit":"piece"},
{"name":"Nosing","weight":"light","unit":"piece"},
{"name":"Adhesive / mortar","weight":"heavy","unit":"bag"},
{"name":"Custom item","weight":"medium","unit":"unit"}
],"showFields":["description","quantity","weight","unit_type"],"bundleRules":{"freeAccessories":["T-moulds","Reducers","Quarter round / trim","Nosing"],"includedQuantity":50,"perUnitAfter":1}}
$ic_flooring$::jsonb
    )
WHERE code = 'flooring';

-- designer
UPDATE public.delivery_verticals SET
  base_rate = 250,
  items_included_in_base = 5,
  per_item_rate_after_base = 20,
  default_config = (COALESCE(default_config, '{}'::jsonb) - 'item_config' - 'field_visibility')
    || jsonb_build_object(
      'field_visibility',
      '{"show":["handling","assembly","debris_removal","artwork","high_value","time_sensitive"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup_install","returns","haul_away","same_day","antiques"],"defaultHandling":"white_glove","defaultCrew":2,"multiStopDefault":false}'::jsonb,
      'item_config',
      $ic_designer$
{"label":"Design Project Items","quickAdd":[
{"name":"Sofa / Sectional","weight":"heavy"},{"name":"Accent Chair","weight":"medium"},{"name":"Ottoman","weight":"medium"},{"name":"Dining Table","weight":"heavy"},{"name":"Dining Chair","weight":"light"},{"name":"Coffee Table","weight":"medium"},{"name":"Side Table","weight":"light"},{"name":"Console","weight":"medium"},{"name":"Area Rug","weight":"medium"},{"name":"Rug Pad","weight":"light"},{"name":"Artwork / Frame","weight":"light","fragile":true},{"name":"Mirror","weight":"medium","fragile":true},{"name":"Lamp / Lighting","weight":"light","fragile":true},{"name":"Cushion / Throw","weight":"light"},{"name":"Decorative Object","weight":"light"},{"name":"Television","weight":"medium"},{"name":"TV Mount / Bracket","weight":"light"},{"name":"Custom item","weight":"medium"}
],"showFields":["description","quantity","weight","fragile","stop_assignment"],"bundleRules":{"freeAccessories":["Cushion / Throw","Rug Pad","TV Mount / Bracket","Decorative Object","Hardware kit","Legs / feet"],"includedQuantity":5,"perPieceAfter":20}}
$ic_designer$::jsonb
    )
WHERE code = 'designer';

-- cabinetry
UPDATE public.delivery_verticals SET
  base_rate = 200,
  items_included_in_base = 5,
  per_item_rate_after_base = 35,
  default_config = (COALESCE(default_config, '{}'::jsonb) - 'item_config' - 'field_visibility')
    || jsonb_build_object(
      'field_visibility',
      '{"show":["handling","debris_removal"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup_install","returns","haul_away","same_day","artwork","antiques"],"defaultHandling":"room_of_choice","defaultCrew":2,"multiStopDefault":false}'::jsonb,
      'item_config',
      $ic_cab$
{"label":"Cabinetry & Fixtures","quickAdd":[
{"name":"Upper cabinet","weight":"heavy"},{"name":"Lower / base cabinet","weight":"extra_heavy"},{"name":"Pantry / tall cabinet","weight":"extra_heavy"},{"name":"Vanity","weight":"heavy"},{"name":"Countertop slab","weight":"extra_heavy","fragile":true},{"name":"Island unit","weight":"extra_heavy"},{"name":"Closet system panels","weight":"medium"},{"name":"Doors / drawer fronts","weight":"light"},{"name":"Hardware box","weight":"light"},{"name":"Filler strips / trim","weight":"light"},{"name":"Custom item","weight":"medium"}
],"showFields":["description","quantity","weight","fragile"],"bundleRules":{"freeAccessories":["Hardware box","Filler strips / trim","Doors / drawer fronts"],"includedQuantity":5,"perPieceAfter":35}}
$ic_cab$::jsonb
    )
WHERE code = 'cabinetry';

-- medical_equipment
UPDATE public.delivery_verticals SET
  base_rate = 350,
  items_included_in_base = 1,
  per_item_rate_after_base = 75,
  default_config = (COALESCE(default_config, '{}'::jsonb) - 'item_config' - 'field_visibility')
    || jsonb_build_object(
      'field_visibility',
      '{"show":["handling","chain_of_custody","high_value"],"hide":["box_count","skid_count","total_weight","hookup_install","returns","haul_away","same_day","assembly"],"defaultHandling":"white_glove","defaultCrew":2,"multiStopDefault":false}'::jsonb,
      'item_config',
      $ic_med$
{"label":"Medical Equipment","quickAdd":[
{"name":"Ultrasound machine","weight":"heavy"},{"name":"Exam table","weight":"extra_heavy"},{"name":"Dental chair","weight":"extra_heavy"},{"name":"X-ray unit","weight":"heavy","fragile":true},{"name":"Lab instrument","weight":"medium","fragile":true},{"name":"Monitor / display","weight":"medium","fragile":true},{"name":"Medical cart","weight":"medium"},{"name":"Sterilization unit","weight":"heavy"},{"name":"Custom item","weight":"medium"}
],"showFields":["description","quantity","weight","fragile","serial_number"],"bundleRules":{"includedQuantity":1,"perPieceAfter":75}}
$ic_med$::jsonb
    )
WHERE code = 'medical_equipment';

-- appliance
UPDATE public.delivery_verticals SET
  base_rate = 175,
  items_included_in_base = 1,
  per_item_rate_after_base = 50,
  default_config = (COALESCE(default_config, '{}'::jsonb) - 'item_config' - 'field_visibility')
    || jsonb_build_object(
      'field_visibility',
      '{"show":["handling","hookup_install","haul_away"],"hide":["box_count","skid_count","total_weight","chain_of_custody","returns","same_day","artwork","antiques"],"defaultHandling":"room_of_choice","defaultCrew":2,"multiStopDefault":false}'::jsonb,
      'item_config',
      $ic_app$
{"label":"Appliances","quickAdd":[
{"name":"Refrigerator","weight":"extra_heavy"},{"name":"Washer","weight":"extra_heavy"},{"name":"Dryer","weight":"extra_heavy"},{"name":"Dishwasher","weight":"heavy"},{"name":"Stove / Range","weight":"extra_heavy"},{"name":"Microwave","weight":"medium"},{"name":"Wine cooler","weight":"heavy"},{"name":"Freezer","weight":"extra_heavy"},{"name":"Custom item","weight":"heavy"}
],"showFields":["description","quantity","weight","hookup_required","haul_away_old"],"bundleRules":{"includedQuantity":1,"perPieceAfter":50}}
$ic_app$::jsonb
    )
WHERE code = 'appliance';

-- art_gallery
UPDATE public.delivery_verticals SET
  base_rate = 250,
  items_included_in_base = 3,
  per_item_rate_after_base = 40,
  default_config = (COALESCE(default_config, '{}'::jsonb) - 'item_config' - 'field_visibility')
    || jsonb_build_object(
      'field_visibility',
      '{"show":["handling","artwork","high_value"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup_install","returns","haul_away","same_day"],"defaultHandling":"white_glove","defaultCrew":2,"multiStopDefault":false}'::jsonb,
      'item_config',
      $ic_art$
{"label":"Art & Gallery Pieces","quickAdd":[
{"name":"Painting (small <24\")","weight":"light","fragile":true},{"name":"Painting (medium 24-48\")","weight":"medium","fragile":true},{"name":"Painting (large 48\"+)","weight":"medium","fragile":true},{"name":"Sculpture","weight":"heavy","fragile":true},{"name":"Framed photograph","weight":"light","fragile":true},{"name":"Print / lithograph","weight":"light","fragile":true},{"name":"Installation piece","weight":"heavy"},{"name":"Pedestal / display","weight":"medium"},{"name":"Custom item","weight":"medium","fragile":true}
],"showFields":["description","quantity","weight","fragile","crating_required","declared_value"],"bundleRules":{"includedQuantity":3,"perPieceAfter":40}}
$ic_art$::jsonb
    )
WHERE code = 'art_gallery';

-- restaurant_hospitality
UPDATE public.delivery_verticals SET
  base_rate = 175,
  items_included_in_base = 5,
  per_item_rate_after_base = 20,
  default_config = (COALESCE(default_config, '{}'::jsonb) - 'item_config' - 'field_visibility')
    || jsonb_build_object(
      'field_visibility',
      '{"show":["handling","assembly"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup_install","returns","haul_away","artwork","antiques"],"defaultHandling":"threshold","defaultCrew":2,"multiStopDefault":false}'::jsonb,
      'item_config',
      $ic_rest$
{"label":"Restaurant & Hospitality","quickAdd":[
{"name":"Table","weight":"heavy"},{"name":"Chair","weight":"light"},{"name":"Booth / banquette","weight":"extra_heavy"},{"name":"Bar stool","weight":"light"},{"name":"POS system","weight":"medium","fragile":true},{"name":"Display case","weight":"heavy","fragile":true},{"name":"Kitchen equipment","weight":"extra_heavy"},{"name":"Signage","weight":"medium"},{"name":"Custom item","weight":"medium"}
],"showFields":["description","quantity","weight","fragile"],"bundleRules":{"freeWith":{"Chair":["Table"],"Bar stool":["Table"]},"freeRatio":6,"includedQuantity":5,"perPieceAfter":20}}
$ic_rest$::jsonb
    )
WHERE code = 'restaurant_hospitality';

-- office_furniture
UPDATE public.delivery_verticals SET
  base_rate = 175,
  items_included_in_base = 5,
  per_item_rate_after_base = 20,
  default_config = (COALESCE(default_config, '{}'::jsonb) - 'item_config' - 'field_visibility')
    || jsonb_build_object(
      'field_visibility',
      '{"show":["handling","assembly"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup_install","returns","haul_away","artwork","antiques"],"defaultHandling":"threshold","defaultCrew":2,"multiStopDefault":false}'::jsonb,
      'item_config',
      $ic_off$
{"label":"Office Furniture","quickAdd":[
{"name":"Desk","weight":"heavy"},{"name":"Office chair","weight":"medium"},{"name":"Filing cabinet","weight":"heavy"},{"name":"Bookcase","weight":"heavy"},{"name":"Conference table","weight":"extra_heavy"},{"name":"Cubicle panel","weight":"medium"},{"name":"Credenza","weight":"heavy"},{"name":"Whiteboard","weight":"medium"},{"name":"Custom item","weight":"medium"}
],"showFields":["description","quantity","weight","assembly_required"],"bundleRules":{"includedQuantity":5,"perPieceAfter":20}}
$ic_off$::jsonb
    )
WHERE code = 'office_furniture';

-- ecommerce_bulk
UPDATE public.delivery_verticals SET
  base_rate = 150,
  items_included_in_base = 10,
  per_item_rate_after_base = 10,
  default_config = (COALESCE(default_config, '{}'::jsonb) - 'item_config' - 'field_visibility')
    || jsonb_build_object(
      'field_visibility',
      '{"show":["returns","same_day"],"hide":["skid_count","total_weight","chain_of_custody","hookup_install","haul_away","assembly","artwork","antiques"],"defaultHandling":"threshold","defaultCrew":1,"multiStopDefault":true}'::jsonb,
      'item_config',
      $ic_ec$
{"label":"E-Commerce Parcels","quickAdd":[
{"name":"Small parcel","weight":"light"},{"name":"Medium parcel","weight":"medium"},{"name":"Large parcel","weight":"heavy"},{"name":"Oversized item","weight":"extra_heavy"},{"name":"Custom item","weight":"medium"}
],"showFields":["description","quantity","weight"],"bundleRules":{"includedQuantity":10,"perPieceAfter":10}}
$ic_ec$::jsonb
    )
WHERE code = 'ecommerce_bulk';

-- custom
UPDATE public.delivery_verticals SET
  base_rate = 200,
  items_included_in_base = 3,
  per_item_rate_after_base = 30,
  default_config = (COALESCE(default_config, '{}'::jsonb) - 'item_config' - 'field_visibility')
    || jsonb_build_object(
      'field_visibility',
      '{"show":["handling","assembly","debris_removal"],"hide":["box_count","skid_count","total_weight","chain_of_custody","hookup_install","returns","haul_away"],"defaultHandling":"threshold","defaultCrew":2,"multiStopDefault":false}'::jsonb,
      'item_config',
      $ic_cust$
{"label":"Items","quickAdd":[{"name":"Custom item","weight":"medium"}],"showFields":["description","quantity","weight","fragile"],"bundleRules":{"includedQuantity":3,"perPieceAfter":30}}
$ic_cust$::jsonb
    )
WHERE code = 'custom';
