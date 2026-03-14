-- Add vertical + portal_features to organizations
-- vertical: maps to PartnerVertical enum (furniture_retailer, interior_designer, etc.)
-- portal_features: JSONB flags controlling which tabs show in partner portal

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS vertical TEXT,
  ADD COLUMN IF NOT EXISTS portal_features JSONB
    DEFAULT '{"projects":false,"day_rates":false,"recurring_schedules":false}'::jsonb;

-- Seed vertical from existing org type values (legacy compat)
UPDATE organizations SET vertical = 'furniture_retailer' WHERE type = 'retail' AND vertical IS NULL;
UPDATE organizations SET vertical = 'interior_designer'  WHERE type = 'designer' AND vertical IS NULL;
UPDATE organizations SET vertical = 'art_gallery'        WHERE type = 'gallery' AND vertical IS NULL;
UPDATE organizations SET vertical = type WHERE vertical IS NULL AND type NOT IN ('b2c','b2b');

-- Set portal_features defaults based on vertical for orgs that haven't been manually configured
-- furniture_design group: day_rates + recurring, no projects
UPDATE organizations
  SET portal_features = '{"projects":false,"day_rates":true,"recurring_schedules":true}'::jsonb
  WHERE vertical IN ('furniture_retailer','cabinetry','flooring')
  AND (portal_features IS NULL OR portal_features = '{}'::jsonb OR portal_features = '{"projects":false,"day_rates":false,"recurring_schedules":false}'::jsonb);

-- interior_designer: projects + day_rates
UPDATE organizations
  SET portal_features = '{"projects":true,"day_rates":true,"recurring_schedules":false}'::jsonb
  WHERE vertical = 'interior_designer'
  AND (portal_features IS NULL OR portal_features = '{}'::jsonb OR portal_features = '{"projects":false,"day_rates":false,"recurring_schedules":false}'::jsonb);

-- art_specialty: projects only
UPDATE organizations
  SET portal_features = '{"projects":true,"day_rates":false,"recurring_schedules":false}'::jsonb
  WHERE vertical IN ('art_gallery','antique_dealer')
  AND (portal_features IS NULL OR portal_features = '{}'::jsonb OR portal_features = '{"projects":false,"day_rates":false,"recurring_schedules":false}'::jsonb);

-- hospitality_commercial: all three
UPDATE organizations
  SET portal_features = '{"projects":true,"day_rates":true,"recurring_schedules":true}'::jsonb
  WHERE vertical = 'hospitality'
  AND (portal_features IS NULL OR portal_features = '{}'::jsonb OR portal_features = '{"projects":false,"day_rates":false,"recurring_schedules":false}'::jsonb);

-- medical/technical/appliances: none
UPDATE organizations
  SET portal_features = '{"projects":false,"day_rates":false,"recurring_schedules":false}'::jsonb
  WHERE vertical IN ('medical_equipment','av_technology','appliances')
  AND (portal_features IS NULL OR portal_features = '{}'::jsonb);

-- referral partners: none
UPDATE organizations
  SET portal_features = '{"projects":false,"day_rates":false,"recurring_schedules":false}'::jsonb
  WHERE vertical IN ('realtor','property_manager','developer')
  AND (portal_features IS NULL OR portal_features = '{}'::jsonb);

-- RLS: allow partner portal to read own org features
-- (no new policy needed — organizations already readable by partner_users via existing RLS)
