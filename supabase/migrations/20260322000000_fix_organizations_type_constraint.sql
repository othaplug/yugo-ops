-- Fix organizations_type_check constraint to allow all partner verticals.
-- The old constraint only allowed legacy values (b2c, b2b, retail, designer, gallery).
-- New partner creation writes the full vertical slug (interior_designer, furniture_retailer, etc.)
-- into the type column, which violated the constraint.
--
-- Strategy:
--   1. Drop the old constraint.
--   2. Re-add it to allow b2c, b2b, and all 12 canonical partner verticals.
--   3. Back-fill `vertical` on any partner org that is missing it.

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_type_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_type_check CHECK (
    type IN (
      -- persona types
      'b2c', 'b2b',
      -- legacy types (kept for backward compat)
      'retail', 'designer', 'gallery',
      -- canonical partner verticals
      'furniture_retailer', 'interior_designer', 'cabinetry', 'flooring',
      'art_gallery', 'antique_dealer',
      'hospitality',
      'medical_equipment', 'av_technology', 'appliances',
      'realtor', 'property_manager', 'developer'
    )
  );

-- Back-fill vertical on partner orgs that were inserted before the vertical column existed
-- or where vertical was never set.
UPDATE organizations
  SET vertical = type
  WHERE type NOT IN ('b2c', 'b2b')
    AND vertical IS NULL;
