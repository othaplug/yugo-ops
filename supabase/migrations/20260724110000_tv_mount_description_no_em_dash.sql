-- Strip the em dash from the tv_mounting description (customer-facing
-- copy rule — em dashes read robotic and break the premium/human feel).
-- Rest of the variant_config stays as seeded.

UPDATE public.addons
SET description = 'Premium wall mount installed by our crew. Hardware included, so you never need to buy your own.'
WHERE slug = 'tv_mounting';
