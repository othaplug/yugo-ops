-- Allow HVAC partner vertical on organizations.type.

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
      'medical_equipment', 'av_technology', 'appliances', 'hvac',
      'property_management_residential', 'property_management_commercial', 'developer_builder',
      'realtor', 'property_manager', 'developer'
    )
  );
