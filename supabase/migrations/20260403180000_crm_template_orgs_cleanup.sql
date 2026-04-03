-- Remove placeholder / template-style organization rows from CRM partner lists
DELETE FROM public.organizations
WHERE name ILIKE '\_%rate%card%'
   OR name ILIKE '\_%template%';
