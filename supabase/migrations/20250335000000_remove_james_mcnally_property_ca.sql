-- Remove James McNally and Property.ca organization
-- Keeps referral system intact; unlinks referrals from the org before deletion

-- 1. Remove James McNally from realtors table (agent records)
DELETE FROM public.realtors
WHERE agent_name ILIKE '%James McNally%';

-- 2. Unlink referrals from Property.ca org (keep referrals, just clear org link)
UPDATE public.referrals
SET organization_id = NULL
WHERE organization_id IN (
  SELECT id FROM public.organizations
  WHERE name ILIKE '%Property.ca%' OR name ILIKE '%property.ca%'
);

-- 3. Remove partner portal access for Property.ca
DELETE FROM public.partner_users
WHERE org_id IN (
  SELECT id FROM public.organizations
  WHERE name ILIKE '%Property.ca%' OR name ILIKE '%property.ca%'
);

-- 4. Delete Property.ca organization
DELETE FROM public.organizations
WHERE name ILIKE '%Property.ca%' OR name ILIKE '%property.ca%';
