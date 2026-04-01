-- B2B Jobs form: per-vertical show/hide and defaults (editable via admin vertical panel)

UPDATE public.delivery_verticals v
SET default_config = COALESCE(v.default_config, '{}'::jsonb) || jsonb_build_object(
  'field_visibility',
  '{
    "show": ["box_count", "skid_count", "total_weight", "handling"],
    "hide": ["assembly", "haul_away", "returns"],
    "defaultHandling": "hand_bomb",
    "defaultCrew": 2,
    "multiStopDefault": false
  }'::jsonb
)
WHERE v.code = 'flooring';

UPDATE public.delivery_verticals v
SET default_config = COALESCE(v.default_config, '{}'::jsonb) || jsonb_build_object(
  'field_visibility',
  '{
    "show": ["multi_stop", "handling", "assembly", "complexity"],
    "hide": ["box_count", "skid_count", "haul_away", "returns"],
    "defaultHandling": "white_glove",
    "defaultCrew": 2,
    "multiStopDefault": true
  }'::jsonb
)
WHERE v.code = 'designer';

UPDATE public.delivery_verticals v
SET default_config = COALESCE(v.default_config, '{}'::jsonb) || jsonb_build_object(
  'field_visibility',
  '{
    "show": ["handling", "complexity", "chain_of_custody"],
    "hide": ["box_count", "skid_count", "haul_away", "returns"],
    "defaultHandling": "white_glove",
    "defaultCrew": 2,
    "multiStopDefault": false
  }'::jsonb
)
WHERE v.code = 'medical_equipment';

UPDATE public.delivery_verticals v
SET default_config = COALESCE(v.default_config, '{}'::jsonb) || jsonb_build_object(
  'field_visibility',
  '{
    "show": ["handling", "haul_away", "hookup"],
    "hide": ["box_count", "skid_count", "returns", "multi_stop"],
    "defaultHandling": "room_of_choice",
    "defaultCrew": 2,
    "multiStopDefault": false
  }'::jsonb
)
WHERE v.code = 'appliance';

UPDATE public.delivery_verticals v
SET default_config = COALESCE(v.default_config, '{}'::jsonb) || jsonb_build_object(
  'field_visibility',
  '{
    "show": ["multi_stop", "returns", "same_day"],
    "hide": ["skid_count", "haul_away", "assembly"],
    "defaultHandling": "threshold",
    "defaultCrew": 1,
    "multiStopDefault": true
  }'::jsonb
)
WHERE v.code = 'ecommerce_bulk';
