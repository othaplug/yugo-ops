-- Remove "_Rate Card Templates" organization from the database.
-- It is not a real partner; template data lives in rate_card_templates and template_id on rate sub-tables.
-- Template rate card id: a0000000-0000-0000-0000-000000000001
-- Template org id:      b0000000-0000-0000-0000-000000000001

-- 1. Clear any deliveries that reference the template rate card (unlikely)
UPDATE public.deliveries
SET rate_card_id = NULL
WHERE rate_card_id = 'a0000000-0000-0000-0000-000000000001';

-- 2. Delete the template rate card (CASCADE deletes rate_card_day_rates, overages, zones, etc.)
DELETE FROM public.partner_rate_cards
WHERE organization_id = 'b0000000-0000-0000-0000-000000000001';

-- 3. Delete the "_Rate Card Templates" organization
DELETE FROM public.organizations
WHERE id = 'b0000000-0000-0000-0000-000000000001';
