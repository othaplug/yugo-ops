-- Fix flooring vertical pricing:
--   1. Raise base rate $150 → $179
--   2. Switch from flat per-unit (unit_rate $1.50/box) to tiered:
--      30 boxes included in base; $1.25/box beyond
--   3. Add carry_in_flat $75 (flat access fee when coordinator selects carry-in)
--   4. Add flooring_load_tiers so weight surcharge triggers
--   5. Align bundleRules.includedQuantity to match new included threshold (30)

UPDATE delivery_verticals
SET
  base_rate = 179,
  default_config = jsonb_strip_nulls(
    default_config

    -- Tiered box pricing: 30 included, $1.25 per extra
    || jsonb_build_object('items_included_in_base', 30)
    || jsonb_build_object('per_item_rate_after_base', 1.25)
    -- Zero out the old flat unit_rate so the tiered path is taken in the engine
    || jsonb_build_object('unit_rate', 0)

    -- Weight surcharge tiers for heavy flooring loads
    || jsonb_build_object(
        'flooring_load_tiers',
        jsonb_build_object(
          'standard_max_lb', 1000,
          'heavy_max_lb',    2500,
          'heavy_fee',       40,
          'extra_fee',       80,
          'extra_three_crew', true
        )
    )

    -- Flat carry-in access fee (replaces per-box carry_in_per_box when set)
    || jsonb_build_object(
        'handling_rates',
        (default_config -> 'handling_rates') || '{"carry_in_flat": 75}'::jsonb
    )

    -- Align bundleRules.includedQuantity with new threshold
    || jsonb_build_object(
        'item_config',
        default_config -> 'item_config'
        || jsonb_build_object(
            'bundleRules',
            (default_config -> 'item_config' -> 'bundleRules')
            || '{"includedQuantity": 30}'::jsonb
        )
    )
  )
WHERE code = 'flooring';
