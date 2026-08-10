-- Cabinetry pricing overhaul: retire the per-piece dimensional engine for
-- cabinetry and seed the operator-approved cabinet-unit rate config that the
-- shared priceCabinetryFlatBand engine reads.
--
-- Why: the dimensional engine billed every shelf, door, filler and hardware
-- box as a full "piece" at $35, so a normal kitchen ballooned past $1,600. The
-- new model scores the load in cabinet-units (carcass 1.0, loose part 0.2,
-- hardware 0.0), charges a base that covers the first 8 units + pickup +
-- delivery + threshold drop, then $22/additional unit, with real handling
-- premiums and one unified per-stop fee (no more $55 + $75 double-charge).
--
-- All dollar knobs live in this JSON so they can be tuned without a deploy.

INSERT INTO public.platform_config (key, value)
VALUES (
  'b2b_cabinetry_rate',
  '{
    "base_rate": 450,
    "units_included_in_base": 8,
    "per_unit_rate": 22,
    "extra_pickup_stop_fee": 65,
    "zone_uplift": { "extended_gta": 75, "regional_ontario": 150 },
    "handling": {
      "curbside": 0,
      "threshold": 0,
      "room_of_choice": 150,
      "white_glove_pct": 0.30,
      "white_glove_min": 200
    },
    "long_carry_per_2_units": 35,
    "stairs_per_flight_per_5_units": 35,
    "weekend_pct": 0.10,
    "custom_quote_over_units": 60
  }'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Take cabinetry off the 'dimensional' method so nothing routes it back to the
-- old engine. Pricing is now code-routed by vertical.code === 'cabinetry' to
-- the shared flat-band engine; this column change is belt-and-suspenders +
-- documentation. 'flat' is an allowed pricing_method value.
UPDATE public.delivery_verticals
SET pricing_method = 'flat'
WHERE code = 'cabinetry';

-- P5: expand the cabinetry quick-add catalog so panels and loose parts are
-- first-class items. The count-factor engine scores structural carcasses as
-- 1.0 units, loose parts (shelves, doors, filler, trim) as 0.2 (5 = 1 unit),
-- and true ride-along hardware as 0.0. Weight on each item drives only truck +
-- crew sizing, never the price.
UPDATE public.delivery_verticals
SET default_config = jsonb_set(
  default_config,
  '{item_config,quickAdd}',
  '[
    {"name": "Upper cabinet", "weight": "heavy"},
    {"name": "Lower / base cabinet", "weight": "extra_heavy"},
    {"name": "Pantry / tall cabinet", "weight": "extra_heavy"},
    {"name": "Vanity", "weight": "heavy"},
    {"name": "Sink base cabinet", "weight": "heavy"},
    {"name": "Corner cabinet", "weight": "heavy"},
    {"name": "Island unit", "weight": "extra_heavy"},
    {"name": "Countertop slab", "weight": "extra_heavy", "fragile": true},
    {"name": "Finished end / side panel", "weight": "medium"},
    {"name": "Long panel / gable", "weight": "heavy"},
    {"name": "Shelves", "weight": "light"},
    {"name": "Doors / drawer fronts", "weight": "light"},
    {"name": "Drawer boxes", "weight": "medium"},
    {"name": "Filler strips / trim", "weight": "light"},
    {"name": "Toe-kick / crown moulding", "weight": "light"},
    {"name": "Glass door inserts", "weight": "light", "fragile": true},
    {"name": "Custom item", "weight": "medium"}
  ]'::jsonb,
  true
)
WHERE code = 'cabinetry';

-- Free accessories are now only the true ride-alongs (0.0 units). Loose parts
-- moved into the priced quick-add list above at 0.2 units each.
UPDATE public.delivery_verticals
SET default_config = jsonb_set(
  default_config,
  '{item_config,bundleRules,freeAccessories}',
  '["Hardware box", "Legs / levelers", "Assembly kit"]'::jsonb,
  true
)
WHERE code = 'cabinetry';
