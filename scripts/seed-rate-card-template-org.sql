-- Re-create system template org + default partner rate card (matches migration 20250293000000).
-- Run after wipe-mock-operational-data.sql if organizations count is 0 or template is missing.

DO $$
DECLARE
  tmpl_id UUID := 'a0000000-0000-0000-0000-000000000001';
  tmpl_org_id UUID := 'b0000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.organizations (id, name, type, notes)
  VALUES (tmpl_org_id, '_Rate Card Templates', 'b2c', 'System: holds rate card templates')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.partner_rate_cards (id, organization_id, card_name, effective_date, is_active)
  VALUES (tmpl_id, tmpl_org_id, 'Furniture Retailer Rate Card', CURRENT_DATE, TRUE)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.rate_card_day_rates (rate_card_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier) VALUES
    (tmpl_id, 'sprinter', 590, 360, 6, 3, 'partner'),
    (tmpl_id, '16ft',     760, 465, 6, 3, 'partner'),
    (tmpl_id, '20ft',     930, 575, 6, 3, 'partner'),
    (tmpl_id, '26ft',     1185, 720, 6, 3, 'partner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.rate_card_day_rates (rate_card_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier) VALUES
    (tmpl_id, 'sprinter', 695, 425, 6, 3, 'standard'),
    (tmpl_id, '16ft',     895, 550, 6, 3, 'standard'),
    (tmpl_id, '20ft',     1095, 675, 6, 3, 'standard'),
    (tmpl_id, '26ft',     1395, 850, 6, 3, 'standard')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.rate_card_overages (rate_card_id, overage_tier, price_per_stop, pricing_tier) VALUES
    (tmpl_id, 'full_7_10',    65, 'partner'),
    (tmpl_id, 'full_11_plus', 85, 'partner'),
    (tmpl_id, 'half_4_6',     65, 'partner'),
    (tmpl_id, 'half_7_plus',  85, 'partner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.rate_card_overages (rate_card_id, overage_tier, price_per_stop, pricing_tier) VALUES
    (tmpl_id, 'full_7_10',    85, 'standard'),
    (tmpl_id, 'full_11_plus', 110, 'standard'),
    (tmpl_id, 'half_4_6',     85, 'standard'),
    (tmpl_id, 'half_7_plus',  110, 'standard')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.rate_card_zones (rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier) VALUES
    (tmpl_id, 1, 'GTA Core',       0, 15, 'Downtown, Midtown, East/West End, Liberty Village', 0, 'partner'),
    (tmpl_id, 2, 'Inner Suburbs', 15, 30, 'North York, Scarborough, Etobicoke, Mississauga', 95, 'partner'),
    (tmpl_id, 3, 'Outer GTA',     30, 50, 'Vaughan, Markham, Richmond Hill, Oakville', 165, 'partner'),
    (tmpl_id, 4, 'Extended',      50, 80, 'Hamilton, Barrie, Oshawa, Guelph', 250, 'partner'),
    (tmpl_id, 5, 'Remote',        80, NULL, 'Beyond 80km - quoted on request', 0, 'partner'),
    (tmpl_id, 1, 'GTA Core',       0, 15, 'Downtown, Midtown, East/West End, Liberty Village', 0, 'standard'),
    (tmpl_id, 2, 'Inner Suburbs', 15, 30, 'North York, Scarborough, Etobicoke, Mississauga', 115, 'standard'),
    (tmpl_id, 3, 'Outer GTA',     30, 50, 'Vaughan, Markham, Richmond Hill, Oakville', 195, 'standard'),
    (tmpl_id, 4, 'Extended',      50, 80, 'Hamilton, Barrie, Oshawa, Guelph', 295, 'standard'),
    (tmpl_id, 5, 'Remote',        80, NULL, 'Beyond 80km - quoted on request', 0, 'standard')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.rate_card_delivery_rates (rate_card_id, delivery_type, zone, price_min, price_max, pricing_tier) VALUES
    (tmpl_id, 'single_item',  1, 165, 235, 'partner'),
    (tmpl_id, 'multi_piece',  1, 275, 405, 'partner'),
    (tmpl_id, 'full_room',    1, 445, 640, 'partner'),
    (tmpl_id, 'curbside',     1, 105, 150, 'partner'),
    (tmpl_id, 'oversized',    1, 335, NULL, 'partner'),
    (tmpl_id, 'single_item',  2, 235, 295, 'partner'),
    (tmpl_id, 'multi_piece',  2, 360, 490, 'partner'),
    (tmpl_id, 'full_room',    2, 550, 760, 'partner'),
    (tmpl_id, 'curbside',     2, 150, 210, 'partner'),
    (tmpl_id, 'oversized',    2, 420, NULL, 'partner'),
    (tmpl_id, 'single_item',  1, 195, 275, 'standard'),
    (tmpl_id, 'multi_piece',  1, 325, 475, 'standard'),
    (tmpl_id, 'full_room',    1, 525, 750, 'standard'),
    (tmpl_id, 'curbside',     1, 125, 175, 'standard'),
    (tmpl_id, 'oversized',    1, 395, NULL, 'standard'),
    (tmpl_id, 'single_item',  2, 275, 350, 'standard'),
    (tmpl_id, 'multi_piece',  2, 425, 575, 'standard'),
    (tmpl_id, 'full_room',    2, 650, 895, 'standard'),
    (tmpl_id, 'curbside',     2, 175, 250, 'standard'),
    (tmpl_id, 'oversized',    2, 495, NULL, 'standard')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.rate_card_services (rate_card_id, service_slug, service_name, price_min, price_max, price_unit, pricing_tier) VALUES
    (tmpl_id, 'standard_assembly', 'Standard Assembly', 60, 125, 'flat', 'partner'),
    (tmpl_id, 'complex_assembly', 'Complex Assembly', 125, 255, 'flat', 'partner'),
    (tmpl_id, 'furniture_removal', 'Old Furniture Removal', 80, 165, 'flat', 'partner'),
    (tmpl_id, 'return_pickup', 'Return/Exchange Pickup', 105, 165, 'flat', 'partner'),
    (tmpl_id, 'showroom_transfer', 'Showroom-to-Showroom', 250, NULL, 'flat', 'partner'),
    (tmpl_id, 'staging_setup', 'Staging Setup & Styling', 380, NULL, 'flat', 'partner'),
    (tmpl_id, 'packaging_removal', 'Packaging Removal', 0, 0, 'flat', 'partner'),
    (tmpl_id, 'stair_carry', 'Stair Carry', 40, NULL, 'per_flight', 'partner'),
    (tmpl_id, 'after_hours', 'After Hours Surcharge', 20, NULL, 'percentage', 'partner'),
    (tmpl_id, 'weekend', 'Weekend Surcharge', 10, NULL, 'percentage', 'partner'),
    (tmpl_id, 'multi_stop', 'Additional Stop', 75, NULL, 'per_stop', 'partner'),
    (tmpl_id, 'standard_assembly', 'Standard Assembly', 75, 150, 'flat', 'standard'),
    (tmpl_id, 'complex_assembly', 'Complex Assembly', 150, 300, 'flat', 'standard'),
    (tmpl_id, 'furniture_removal', 'Old Furniture Removal', 95, 195, 'flat', 'standard'),
    (tmpl_id, 'return_pickup', 'Return/Exchange Pickup', 125, 195, 'flat', 'standard'),
    (tmpl_id, 'showroom_transfer', 'Showroom-to-Showroom', 295, NULL, 'flat', 'standard'),
    (tmpl_id, 'staging_setup', 'Staging Setup & Styling', 450, NULL, 'flat', 'standard'),
    (tmpl_id, 'packaging_removal', 'Packaging Removal', 0, 0, 'flat', 'standard'),
    (tmpl_id, 'stair_carry', 'Stair Carry', 50, NULL, 'per_flight', 'standard'),
    (tmpl_id, 'after_hours', 'After Hours Surcharge', 25, NULL, 'percentage', 'standard'),
    (tmpl_id, 'weekend', 'Weekend Surcharge', 15, NULL, 'percentage', 'standard'),
    (tmpl_id, 'multi_stop', 'Additional Stop', 95, NULL, 'per_stop', 'standard')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.rate_card_volume_bonuses (rate_card_id, min_deliveries, max_deliveries, discount_pct) VALUES
    (tmpl_id, 10, 30, 0),
    (tmpl_id, 31, 60, 5),
    (tmpl_id, 61, 100, 10),
    (tmpl_id, 101, NULL, 15)
  ON CONFLICT DO NOTHING;
END $$;
