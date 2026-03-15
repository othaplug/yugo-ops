-- Remove James McNally and Property.ca organization
-- Keeps referral system intact; unlinks referrals from the org before deletion

-- 1. Remove James McNally from realtors table (agent records)
DELETE FROM public.realtors
WHERE agent_name ILIKE '%James McNally%';

-- 2. Unlink referrals from Property.ca org (keep referrals, just clear org link) if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'referrals' AND column_name = 'organization_id'
  ) THEN
    UPDATE public.referrals
    SET organization_id = NULL
    WHERE organization_id IN (
      SELECT id FROM public.organizations
      WHERE name ILIKE '%Property.ca%' OR name ILIKE '%property.ca%'
    );
  END IF;
END $$;

-- 3. Remove partner portal access for Property.ca
DELETE FROM public.partner_users
WHERE org_id IN (
  SELECT id FROM public.organizations
  WHERE name ILIKE '%Property.ca%' OR name ILIKE '%property.ca%'
);

-- 3b. Remove partner_rate_cards that reference Property.ca (FK blocks org delete otherwise)
DELETE FROM public.partner_rate_cards
WHERE organization_id IN (
  SELECT id FROM public.organizations
  WHERE name ILIKE '%Property.ca%' OR name ILIKE '%property.ca%'
);

-- 4. Delete Property.ca organization
DELETE FROM public.organizations
WHERE name ILIKE '%Property.ca%' OR name ILIKE '%property.ca%';
