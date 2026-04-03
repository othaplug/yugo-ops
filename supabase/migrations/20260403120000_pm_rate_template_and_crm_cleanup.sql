-- Property Management rate card template row (for organizations.template_id) + CRM cleanup
--
-- Remove legacy "_Rate Card Templates" system org: clear deliveries + partner_rate_cards
-- first (FK partner_rate_cards_organization_id_fkey). Matches intent of
-- 20250395000000_remove_rate_card_templates_org.sql; idempotent if already applied.

UPDATE public.deliveries d
SET rate_card_id = NULL
FROM public.partner_rate_cards prc
INNER JOIN public.organizations o ON o.id = prc.organization_id
WHERE d.rate_card_id = prc.id
  AND (
    o.name = '_Rate Card Templates'
    OR o.id = 'b0000000-0000-0000-0000-000000000001'::uuid
  );

-- Legacy template rate card id (in case join above missed an orphan reference)
UPDATE public.deliveries
SET rate_card_id = NULL
WHERE rate_card_id = 'a0000000-0000-0000-0000-000000000001'::uuid;

DELETE FROM public.partner_rate_cards prc
USING public.organizations o
WHERE prc.organization_id = o.id
  AND (
    o.name = '_Rate Card Templates'
    OR o.id = 'b0000000-0000-0000-0000-000000000001'::uuid
  );

DELETE FROM public.organizations
WHERE name = '_Rate Card Templates'
   OR id = 'b0000000-0000-0000-0000-000000000001'::uuid;

INSERT INTO public.rate_card_templates (template_name, template_slug, description, verticals_covered, is_active)
VALUES (
  'Property & Portfolio',
  'property_management',
  'Residential tenant moves, renovation displacements, and portfolio pricing (pm_rate_cards matrix)',
  ARRAY[
    'property_management_residential',
    'property_management_commercial',
    'developer_builder'
  ],
  TRUE
)
ON CONFLICT (template_slug) DO UPDATE SET
  template_name = EXCLUDED.template_name,
  description = EXCLUDED.description,
  verticals_covered = EXCLUDED.verticals_covered,
  is_active = TRUE,
  updated_at = NOW();
