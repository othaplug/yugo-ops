-- TV wall mount → variant matrix.
--
-- Replaces the flat $89/TV pricing with a size×type pricing grid so the
-- customer's line reflects the actual mount hardware + install labour
-- for THEIR TV (32-42" tilt costs less than 76-85" full-motion). Mount
-- hardware is bundled into the price (Kanto + Sanus SKUs picked for GTA
-- retail supply and premium positioning).
--
-- Three pieces:
--   1. New price_type value 'variant_matrix' — engine looks up
--      variant_config.sizes[band].types[type].price × quantity.
--   2. New variant_config JSONB column on addons — holds the whole grid
--      plus display strings (labels, descriptions, inclusions) so
--      operators can retune from Settings without a deploy.
--   3. tv_mounting row swapped over.
--
-- Selection payload extends AddonSelection with an optional
-- { variant: { size, type } }; multiple entries with the same addon_id
-- are legal (one per TV in the household).

ALTER TABLE public.addons DROP CONSTRAINT IF EXISTS addons_price_type_check;
ALTER TABLE public.addons
  ADD CONSTRAINT addons_price_type_check
  CHECK (price_type IN ('flat','per_unit','tiered','percent','variant_matrix'));

ALTER TABLE public.addons
  ADD COLUMN IF NOT EXISTS variant_config JSONB;

UPDATE public.addons
SET
  name = 'TV wall mounting',
  description = 'Premium wall mount installed by our crew. Hardware included — no need to buy your own.',
  price_type = 'variant_matrix',
  price = 0,
  unit_label = 'per TV',
  variant_config = jsonb_build_object(
    'sizes', jsonb_build_object(
      '32-42', jsonb_build_object(
        'label', '32" – 42"',
        'requires_two_installers', false,
        'types', jsonb_build_object(
          'fixed',       jsonb_build_object('mount_model', 'Kanto PF300',   'labour_minutes', 40, 'price', 219),
          'tilt',        jsonb_build_object('mount_model', 'Kanto PT300',   'labour_minutes', 45, 'price', 279),
          'full_motion', jsonb_build_object('mount_model', 'Kanto M300',    'labour_minutes', 70, 'price', 269)
        )
      ),
      '43-55', jsonb_build_object(
        'label', '43" – 55"',
        'requires_two_installers', false,
        'types', jsonb_build_object(
          'fixed',       jsonb_build_object('mount_model', 'Kanto F3760',   'labour_minutes', 50, 'price', 229),
          'tilt',        jsonb_build_object('mount_model', 'Kanto T3760',   'labour_minutes', 60, 'price', 259),
          'full_motion', jsonb_build_object('mount_model', 'Kanto LDX640',  'labour_minutes', 85, 'price', 359)
        )
      ),
      '56-65', jsonb_build_object(
        'label', '56" – 65"',
        'requires_two_installers', false,
        'types', jsonb_build_object(
          'fixed',       jsonb_build_object('mount_model', 'Kanto F3760',   'labour_minutes', 55, 'price', 239),
          'tilt',        jsonb_build_object('mount_model', 'Sanus VLT6',    'labour_minutes', 65, 'price', 329),
          'full_motion', jsonb_build_object('mount_model', 'Kanto LDX640',  'labour_minutes', 90, 'price', 369)
        )
      ),
      '66-75', jsonb_build_object(
        'label', '66" – 75"',
        'requires_two_installers', false,
        'types', jsonb_build_object(
          'fixed',       jsonb_build_object('mount_model', 'Kanto PF400',   'labour_minutes', 75,  'price', 269),
          'tilt',        jsonb_build_object('mount_model', 'Sanus VLT6',    'labour_minutes', 85,  'price', 349),
          'full_motion', jsonb_build_object('mount_model', 'Kanto PDX650',  'labour_minutes', 120, 'price', 419)
        )
      ),
      '76-85', jsonb_build_object(
        'label', '76" – 85"',
        'requires_two_installers', true,
        'types', jsonb_build_object(
          'fixed',       jsonb_build_object('mount_model', 'Sanus VLL5',    'labour_minutes', 90,  'price', 349),
          'tilt',        jsonb_build_object('mount_model', 'Sanus VLT6',    'labour_minutes', 100, 'price', 369),
          'full_motion', jsonb_build_object('mount_model', 'Sanus VLF728',  'labour_minutes', 135, 'price', 899)
        )
      )
    ),
    'type_labels', jsonb_build_object(
      'fixed', 'Fixed',
      'tilt', 'Tilting',
      'full_motion', 'Full motion'
    ),
    'type_descriptions', jsonb_build_object(
      'fixed', 'Flush to the wall. Best for straight-on viewing in bedrooms and dedicated media rooms.',
      'tilt', 'Tilts up and down to reduce glare. Ideal when the TV sits above eye level.',
      'full_motion', 'Swivels, tilts, and extends from the wall. Best for corners, open layouts, or rooms with multiple seating zones.'
    ),
    'included', jsonb_build_array(
      'Premium wall mount hardware (Kanto or Sanus, matched to your TV)',
      'Professional installation by our trained crew',
      'Stud location and secure wall anchoring',
      'Cable dressing and management',
      'Level and alignment check',
      'Packaging removed and area cleaned'
    ),
    'not_included', jsonb_build_array(
      'In-wall cable concealment (available as a separate add-on)',
      'Concrete or brick wall surcharge (we will confirm your wall type before install)'
    ),
    'min_size_inches', 32,
    'max_size_inches', 85
  )
WHERE slug = 'tv_mounting';
