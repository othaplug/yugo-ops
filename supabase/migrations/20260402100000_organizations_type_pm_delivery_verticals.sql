-- Property & portfolio partner verticals are written to organizations.type during onboarding
-- (property_management_residential, property_management_commercial, developer_builder).
-- They were missing from organizations_type_check, causing inserts to fail with:
--   new row for relation "organizations" violates check constraint "organizations_type_check"

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_type_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_type_check CHECK (
    type IN (
      'b2c', 'b2b',
      'retail', 'designer', 'gallery',
      'furniture_retailer', 'interior_designer', 'cabinetry', 'flooring',
      'art_gallery', 'antique_dealer',
      'hospitality',
      'medical_equipment', 'av_technology', 'appliances',
      'property_management_residential', 'property_management_commercial', 'developer_builder',
      'realtor', 'property_manager', 'developer'
    )
  );

UPDATE organizations
SET vertical = type
WHERE type NOT IN ('b2c', 'b2b')
  AND vertical IS NULL;
