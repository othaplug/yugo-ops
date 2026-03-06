-- Update service zone definitions to new 4-zone structure
-- Zone 1: GTA (0-40 km) — Included
-- Zone 2: Outer GTA (40-70 km) — + $145
-- Zone 3: Extended (70-100 km) — + $245
-- Zone 4: Remote (100+ km) — Custom

-- Remove old zone definitions (zones 1-5)
DELETE FROM public.rate_card_zones WHERE zone_number IN (1, 2, 3, 4, 5);

-- Insert new zones for each existing rate card (partner + standard tiers)
INSERT INTO public.rate_card_zones (rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier)
SELECT id, 1, 'GTA', 0, 40,
  'Downtown Toronto, Midtown, East/West End, Liberty Village, North York, Scarborough, Etobicoke, Mississauga, East York',
  0, 'partner'
FROM public.partner_rate_cards;

INSERT INTO public.rate_card_zones (rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier)
SELECT id, 2, 'Outer GTA', 40, 70,
  'Vaughan, Markham, Richmond Hill, Oakville, Burlington, Pickering, Ajax, Brampton, Milton',
  145, 'partner'
FROM public.partner_rate_cards;

INSERT INTO public.rate_card_zones (rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier)
SELECT id, 3, 'Extended', 70, 100,
  'Hamilton, Barrie, Oshawa, Guelph, Kitchener-Waterloo, Cambridge, St. Catharines',
  245, 'partner'
FROM public.partner_rate_cards;

INSERT INTO public.rate_card_zones (rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier)
SELECT id, 4, 'Remote', 100, NULL,
  'Beyond 100 km from Toronto core — custom quoted',
  0, 'partner'
FROM public.partner_rate_cards;

-- Standard tier (slightly higher surcharges for non-partner pricing)
INSERT INTO public.rate_card_zones (rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier)
SELECT id, 1, 'GTA', 0, 40,
  'Downtown Toronto, Midtown, East/West End, Liberty Village, North York, Scarborough, Etobicoke, Mississauga, East York',
  0, 'standard'
FROM public.partner_rate_cards;

INSERT INTO public.rate_card_zones (rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier)
SELECT id, 2, 'Outer GTA', 40, 70,
  'Vaughan, Markham, Richmond Hill, Oakville, Burlington, Pickering, Ajax, Brampton, Milton',
  175, 'standard'
FROM public.partner_rate_cards;

INSERT INTO public.rate_card_zones (rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier)
SELECT id, 3, 'Extended', 70, 100,
  'Hamilton, Barrie, Oshawa, Guelph, Kitchener-Waterloo, Cambridge, St. Catharines',
  295, 'standard'
FROM public.partner_rate_cards;

INSERT INTO public.rate_card_zones (rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier)
SELECT id, 4, 'Remote', 100, NULL,
  'Beyond 100 km from Toronto core — custom quoted',
  0, 'standard'
FROM public.partner_rate_cards;
