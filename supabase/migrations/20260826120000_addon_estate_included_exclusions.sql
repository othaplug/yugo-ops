-- Fix the Estate add-on double-charge at the data layer.
--
-- These services are bundled into the Estate package, but their `addons` rows
-- had excluded_tiers = NULL, so the pricing engine charged them on top of the
-- Estate price (double-charge). The code list ESTATE_INCLUDED_SLUGS
-- (src/lib/quotes/addon-visibility.ts) already hid them from the Estate UI; this
-- makes the DB agree so pricing and visibility share one source of truth.
--
-- full_packing / unpacking already carry excluded_tiers = {estate} and stay
-- chargeable on Essential + Signature (which do not include full packing).
-- secure_storage and junk_removal are intentionally NOT excluded — they are
-- distinct paid services on every tier, including Estate.
--
-- Idempotent: only appends 'estate' when it is not already present.

UPDATE public.addons
SET excluded_tiers = ARRAY(
  SELECT DISTINCT unnest(
    COALESCE(excluded_tiers, ARRAY[]::text[]) || ARRAY['estate']::text[]
  )
)
WHERE slug IN (
  'packing_materials',
  'packing_materials_kit',
  'packing_materials_premium',
  'picture_crating',
  'plastic_bin_rental',
  'mattress_bag',
  'extra_assembly',
  'furniture_assembly',
  'floor_protection'
)
AND (excluded_tiers IS NULL OR NOT ('estate' = ANY(excluded_tiers)));
