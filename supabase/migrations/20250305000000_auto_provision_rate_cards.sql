-- ===================================================================
-- Auto-provision rate cards for all organizations that don't have one
-- Copies rates from the Furniture Retailer template card
-- ===================================================================

DO $$
DECLARE
  tmpl_id UUID := 'a0000000-0000-0000-0000-000000000001';
  tmpl_org_id UUID := 'b0000000-0000-0000-0000-000000000001';
  org RECORD;
  new_card_id UUID;
BEGIN
  FOR org IN
    SELECT o.id, o.name
    FROM public.organizations o
    WHERE o.id != tmpl_org_id
      AND NOT EXISTS (
        SELECT 1 FROM public.partner_rate_cards rc
        WHERE rc.organization_id = o.id AND rc.is_active = TRUE
      )
  LOOP
    new_card_id := gen_random_uuid();

    INSERT INTO public.partner_rate_cards (id, organization_id, card_name, effective_date, is_active)
    VALUES (new_card_id, org.id, 'Standard Rate Card', CURRENT_DATE, TRUE);

    -- Copy day rates
    INSERT INTO public.rate_card_day_rates (rate_card_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier)
    SELECT new_card_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier
    FROM public.rate_card_day_rates WHERE rate_card_id = tmpl_id;

    -- Copy overages
    INSERT INTO public.rate_card_overages (rate_card_id, overage_tier, price_per_stop, pricing_tier)
    SELECT new_card_id, overage_tier, price_per_stop, pricing_tier
    FROM public.rate_card_overages WHERE rate_card_id = tmpl_id;

    -- Copy zones
    INSERT INTO public.rate_card_zones (rate_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier)
    SELECT new_card_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier
    FROM public.rate_card_zones WHERE rate_card_id = tmpl_id;

    -- Copy delivery rates
    INSERT INTO public.rate_card_delivery_rates (rate_card_id, delivery_type, zone, price_min, price_max, pricing_tier)
    SELECT new_card_id, delivery_type, zone, price_min, price_max, pricing_tier
    FROM public.rate_card_delivery_rates WHERE rate_card_id = tmpl_id;

    -- Copy services
    INSERT INTO public.rate_card_services (rate_card_id, service_slug, service_name, price_min, price_max, price_unit, pricing_tier)
    SELECT new_card_id, service_slug, service_name, price_min, price_max, price_unit, pricing_tier
    FROM public.rate_card_services WHERE rate_card_id = tmpl_id;

    -- Copy volume bonuses
    INSERT INTO public.rate_card_volume_bonuses (rate_card_id, min_deliveries, max_deliveries, discount_pct)
    SELECT new_card_id, min_deliveries, max_deliveries, discount_pct
    FROM public.rate_card_volume_bonuses WHERE rate_card_id = tmpl_id;

    -- Copy distance overages (if table exists)
    BEGIN
      INSERT INTO public.rate_card_distance_overages (rate_card_id, pricing_tier, from_km, to_km, rate_per_km)
      SELECT new_card_id, pricing_tier, from_km, to_km, rate_per_km
      FROM public.rate_card_distance_overages WHERE rate_card_id = tmpl_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    -- Copy heavy item surcharges (if table exists)
    BEGIN
      INSERT INTO public.rate_card_heavy_surcharges (rate_card_id, pricing_tier, weight_tier, surcharge)
      SELECT new_card_id, pricing_tier, weight_tier, surcharge
      FROM public.rate_card_heavy_surcharges WHERE rate_card_id = tmpl_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;

    RAISE NOTICE 'Created rate card % for org % (%)', new_card_id, org.id, org.name;
  END LOOP;
END $$;
