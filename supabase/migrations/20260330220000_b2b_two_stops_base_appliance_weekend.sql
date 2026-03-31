-- Prompt 4 follow-up: standard B2B jobs are pickup + delivery (2 stops in base).
-- Previously free_stops=1 charged every A→B job an extra stop fee.
-- Appliance: spec is weekend surcharge only (no after-hours add-on).
--
-- Mirror column may be missing if 20260330210000 was not applied on this project;
-- add it here so this migration is safe to run alone.

ALTER TABLE public.delivery_verticals
  ADD COLUMN IF NOT EXISTS stops_included_in_base INTEGER;

UPDATE public.delivery_verticals
SET
  default_config = jsonb_set(
    COALESCE(default_config, '{}'::jsonb),
    '{free_stops}',
    '2'::jsonb,
    true
  ),
  stops_included_in_base = 2
WHERE code IN (
  'furniture_retail',
  'flooring',
  'art_gallery',
  'medical_equipment',
  'appliance',
  'restaurant_hospitality',
  'ecommerce_bulk'
)
AND COALESCE((default_config->>'free_stops')::integer, 0) = 1;

-- Appliance vertical: remove after-hours schedule surcharge (weekend +$40 only per spec).
UPDATE public.delivery_verticals
SET default_config = COALESCE(default_config, '{}'::jsonb) #- '{schedule_surcharges,after_hours}'
WHERE code = 'appliance';

-- Ensure weekend key remains if object became empty — re-merge from prior behavior
UPDATE public.delivery_verticals
SET default_config = jsonb_set(
  COALESCE(default_config, '{}'::jsonb),
  '{schedule_surcharges}',
  COALESCE(default_config->'schedule_surcharges', '{}'::jsonb) || '{"weekend": 40}'::jsonb,
  true
)
WHERE code = 'appliance';
