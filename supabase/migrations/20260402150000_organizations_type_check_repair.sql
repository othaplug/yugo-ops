-- Idempotent repair for organizations_type_check.
-- If partner activation still fails with:
--   new row for relation "organizations" violates check constraint "organizations_type_check"
-- your linked database has not applied 20260402100000 (or the constraint was recreated without PM verticals).
-- This migration re-applies the full allow-list; safe to run even if 20260402100000 already ran.

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
