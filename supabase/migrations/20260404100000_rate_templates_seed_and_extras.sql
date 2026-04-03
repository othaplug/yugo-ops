-- Rate card templates: schema extras + full seed for industry templates (except Furniture & Design).
-- Hospitality: remove property_manager from template verticals (PM belongs under Property & Portfolio).
-- Referral + Property & Portfolio: template_kind + JSON extras for non-delivery structures.

ALTER TABLE public.rate_card_templates
  ADD COLUMN IF NOT EXISTS template_kind TEXT NOT NULL DEFAULT 'delivery';

ALTER TABLE public.rate_card_templates
  ADD COLUMN IF NOT EXISTS extras JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.rate_card_templates.template_kind IS 'delivery | referral | property_portfolio';
COMMENT ON COLUMN public.rate_card_templates.extras IS 'Structured template payload (commission, PM matrix, surcharges) when template_kind != delivery';

-- ─── Hospitality verticals (remove property_manager) ───
UPDATE public.rate_card_templates
SET
  verticals_covered = ARRAY['hospitality', 'developer']::text[],
  updated_at = NOW()
WHERE template_slug = 'hospitality_commercial';

UPDATE public.rate_card_templates
SET
  description = 'Commission-based referrals for realtors, developers, and property managers',
  updated_at = NOW()
WHERE template_slug = 'referral';

-- ─── Clear re-seeded template rate rows (keep furniture_design untouched) ───
DELETE FROM public.rate_card_day_rates
WHERE template_id IN (
  SELECT id FROM public.rate_card_templates
  WHERE template_slug IN ('art_specialty', 'hospitality_commercial', 'medical_technical', 'referral', 'property_management')
);

DELETE FROM public.rate_card_delivery_rates
WHERE template_id IN (
  SELECT id FROM public.rate_card_templates
  WHERE template_slug IN ('art_specialty', 'hospitality_commercial', 'medical_technical', 'referral', 'property_management')
);

DELETE FROM public.rate_card_services
WHERE template_id IN (
  SELECT id FROM public.rate_card_templates
  WHERE template_slug IN ('art_specialty', 'hospitality_commercial', 'medical_technical', 'referral', 'property_management')
);

DELETE FROM public.rate_card_overages
WHERE template_id IN (
  SELECT id FROM public.rate_card_templates
  WHERE template_slug IN ('art_specialty', 'hospitality_commercial', 'medical_technical', 'referral', 'property_management')
);

DELETE FROM public.rate_card_zones
WHERE template_id IN (
  SELECT id FROM public.rate_card_templates
  WHERE template_slug IN ('art_specialty', 'hospitality_commercial', 'medical_technical', 'referral', 'property_management')
);

DELETE FROM public.rate_card_volume_bonuses
WHERE template_id IN (
  SELECT id FROM public.rate_card_templates
  WHERE template_slug IN ('art_specialty', 'hospitality_commercial', 'medical_technical', 'referral', 'property_management')
);

-- ─── Template variables ───
DO $$
DECLARE
  art_id UUID;
  hosp_id UUID;
  med_id UUID;
  ref_id UUID;
  pm_id UUID;
  pm_extras JSONB;
BEGIN
  SELECT id INTO art_id FROM public.rate_card_templates WHERE template_slug = 'art_specialty' LIMIT 1;
  SELECT id INTO hosp_id FROM public.rate_card_templates WHERE template_slug = 'hospitality_commercial' LIMIT 1;
  SELECT id INTO med_id FROM public.rate_card_templates WHERE template_slug = 'medical_technical' LIMIT 1;
  SELECT id INTO ref_id FROM public.rate_card_templates WHERE template_slug = 'referral' LIMIT 1;
  SELECT id INTO pm_id FROM public.rate_card_templates WHERE template_slug = 'property_management' LIMIT 1;

  IF art_id IS NULL OR hosp_id IS NULL OR med_id IS NULL OR ref_id IS NULL OR pm_id IS NULL THEN
    RAISE NOTICE 'One or more rate_card_templates rows missing; skipping seed';
    RETURN;
  END IF;

  -- ========== ART & SPECIALTY ==========
  INSERT INTO public.rate_card_day_rates (template_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier) VALUES
    (art_id, 'sprinter', 650, 400, 8, 4, 'standard'),
    (art_id, 'sprinter', 850, 500, 6, 3, 'partner'),
    (art_id, '16ft', 800, 475, 6, 3, 'standard'),
    (art_id, '16ft', 1000, 600, 5, 3, 'partner'),
    (art_id, '20ft', 1200, 700, 4, 2, 'partner');

  -- Per-piece by zone (standard = Standard tier, partner = White Glove)
  INSERT INTO public.rate_card_delivery_rates (template_id, delivery_type, zone, price_min, price_max, pricing_tier) VALUES
    (art_id, 'art_piece_small', 1, 60, NULL, 'standard'),
    (art_id, 'art_piece_small', 2, 80, NULL, 'standard'),
    (art_id, 'art_piece_small', 3, 120, NULL, 'standard'),
    (art_id, 'art_piece_medium', 1, 85, NULL, 'standard'),
    (art_id, 'art_piece_medium', 2, 110, NULL, 'standard'),
    (art_id, 'art_piece_medium', 3, 150, NULL, 'standard'),
    (art_id, 'art_piece_large', 1, 120, NULL, 'standard'),
    (art_id, 'art_piece_large', 2, 150, NULL, 'standard'),
    (art_id, 'art_piece_large', 3, 200, NULL, 'standard'),
    (art_id, 'art_piece_small', 1, 90, NULL, 'partner'),
    (art_id, 'art_piece_small', 2, 120, NULL, 'partner'),
    (art_id, 'art_piece_small', 3, 175, NULL, 'partner'),
    (art_id, 'art_piece_medium', 1, 130, NULL, 'partner'),
    (art_id, 'art_piece_medium', 2, 160, NULL, 'partner'),
    (art_id, 'art_piece_medium', 3, 225, NULL, 'partner'),
    (art_id, 'art_piece_large', 1, 175, NULL, 'partner'),
    (art_id, 'art_piece_large', 2, 210, NULL, 'partner'),
    (art_id, 'art_piece_large', 3, 300, NULL, 'partner'),
    (art_id, 'art_sculpture_3d', 1, 200, NULL, 'partner'),
    (art_id, 'art_sculpture_3d', 2, 250, NULL, 'partner'),
    (art_id, 'art_sculpture_3d', 3, 350, NULL, 'partner');

  INSERT INTO public.rate_card_services (template_id, service_slug, service_name, price_min, price_max, price_unit, pricing_tier) VALUES
    (art_id, 'art_crating', 'Custom crating (per piece)', 175, NULL, 'flat', 'standard'),
    (art_id, 'art_crating', 'Custom crating (per piece)', 175, NULL, 'flat', 'partner'),
    (art_id, 'art_insurance', 'Insurance premium (per $10K value)', 25, NULL, 'per_10k', 'standard'),
    (art_id, 'art_insurance', 'Insurance premium (per $10K value)', 25, NULL, 'per_10k', 'partner'),
    (art_id, 'art_climate', 'Climate-controlled transport', 150, NULL, 'flat', 'standard'),
    (art_id, 'art_climate', 'Climate-controlled transport', 150, NULL, 'flat', 'partner'),
    (art_id, 'art_install', 'Installation / hanging', 85, NULL, 'per_piece', 'standard'),
    (art_id, 'art_install', 'Installation / hanging', 85, NULL, 'per_piece', 'partner'),
    (art_id, 'art_condition_report', 'Condition report (photo documentation)', 0, 0, 'included', 'standard'),
    (art_id, 'art_condition_report', 'Condition report (photo documentation)', 0, 0, 'included', 'partner'),
    (art_id, 'art_after_hours_pct', 'After-hours surcharge', 20, NULL, 'percentage', 'standard'),
    (art_id, 'art_after_hours_pct', 'After-hours surcharge', 20, NULL, 'percentage', 'partner');

  INSERT INTO public.rate_card_overages (template_id, overage_tier, price_per_stop, pricing_tier) VALUES
    (art_id, 'art_extra_stop', 100, 'standard'),
    (art_id, 'art_extra_stop', 100, 'partner'),
    (art_id, 'art_wait_30min', 45, 'standard'),
    (art_id, 'art_wait_30min', 45, 'partner'),
    (art_id, 'art_crew_hourly', 55, 'standard'),
    (art_id, 'art_crew_hourly', 55, 'partner'),
    (art_id, 'art_stairs_flight', 50, 'standard'),
    (art_id, 'art_stairs_flight', 50, 'partner');

  INSERT INTO public.rate_card_zones (template_id, zone_number, zone_name, distance_min_km, distance_max_km, coverage_areas, surcharge, pricing_tier) VALUES
    (art_id, 1, 'Zone 1', 0, 20, 'GTA Core (Toronto, East York, North York)', 0, 'standard'),
    (art_id, 2, 'Zone 2', 20, 50, 'Greater GTA (Mississauga, Markham, Oakville)', 0, 'standard'),
    (art_id, 3, 'Zone 3', 50, 100, 'Extended (Hamilton, Barrie, Oshawa)', 0, 'standard'),
    (art_id, 4, 'Zone 4', 100, NULL, 'Long Distance (quote required)', 0, 'standard'),
    (art_id, 1, 'Zone 1', 0, 20, 'GTA Core (Toronto, East York, North York)', 0, 'partner'),
    (art_id, 2, 'Zone 2', 20, 50, 'Greater GTA (Mississauga, Markham, Oakville)', 0, 'partner'),
    (art_id, 3, 'Zone 3', 50, 100, 'Extended (Hamilton, Barrie, Oshawa)', 0, 'partner'),
    (art_id, 4, 'Zone 4', 100, NULL, 'Long Distance (quote required)', 0, 'partner');

  UPDATE public.rate_card_templates
  SET template_kind = 'delivery', extras = '{}'::jsonb, updated_at = NOW()
  WHERE id = art_id;

  -- ========== HOSPITALITY & COMMERCIAL ==========
  INSERT INTO public.rate_card_day_rates (template_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier) VALUES
    (hosp_id, 'sprinter', 550, 325, 10, 5, 'standard'),
    (hosp_id, '16ft', 700, 425, 8, 4, 'standard'),
    (hosp_id, '20ft', 850, 500, 6, 3, 'standard'),
    (hosp_id, '26ft', 1100, 650, 5, 3, 'standard'),
    (hosp_id, '16ft_after_hours', 900, 550, 8, 4, 'standard'),
    (hosp_id, '20ft_after_hours', 1050, 625, 6, 3, 'standard'),
    (hosp_id, 'sprinter', 550, 325, 10, 5, 'partner'),
    (hosp_id, '16ft', 700, 425, 8, 4, 'partner'),
    (hosp_id, '20ft', 850, 500, 6, 3, 'partner'),
    (hosp_id, '26ft', 1100, 650, 5, 3, 'partner'),
    (hosp_id, '16ft_after_hours', 900, 550, 8, 4, 'partner'),
    (hosp_id, '20ft_after_hours', 1050, 625, 6, 3, 'partner');

  INSERT INTO public.rate_card_delivery_rates (template_id, delivery_type, zone, price_min, price_max, pricing_tier) VALUES
    (hosp_id, 'hosp_piece_chair', 1, 15, NULL, 'standard'),
    (hosp_id, 'hosp_piece_table', 1, 35, NULL, 'standard'),
    (hosp_id, 'hosp_piece_kitchen', 1, 75, NULL, 'standard'),
    (hosp_id, 'hosp_booth', 1, 100, NULL, 'standard'),
    (hosp_id, 'hosp_pos', 1, 85, NULL, 'standard'),
    (hosp_id, 'hosp_display', 1, 120, NULL, 'standard'),
    (hosp_id, 'hosp_piece_chair', 1, 15, NULL, 'partner'),
    (hosp_id, 'hosp_piece_table', 1, 35, NULL, 'partner'),
    (hosp_id, 'hosp_piece_kitchen', 1, 75, NULL, 'partner'),
    (hosp_id, 'hosp_booth', 1, 100, NULL, 'partner'),
    (hosp_id, 'hosp_pos', 1, 85, NULL, 'partner'),
    (hosp_id, 'hosp_display', 1, 120, NULL, 'partner');

  INSERT INTO public.rate_card_services (template_id, service_slug, service_name, price_min, price_max, price_unit, pricing_tier) VALUES
    (hosp_id, 'hosp_assembly', 'Assembly per item', 45, NULL, 'flat', 'standard'),
    (hosp_id, 'hosp_assembly', 'Assembly per item', 45, NULL, 'flat', 'partner'),
    (hosp_id, 'hosp_debris', 'Debris / packaging removal', 75, NULL, 'per_load', 'standard'),
    (hosp_id, 'hosp_debris', 'Debris / packaging removal', 75, NULL, 'per_load', 'partner'),
    (hosp_id, 'hosp_after_hours', 'After-hours premium (before 7AM / after 7PM)', 25, NULL, 'percentage', 'standard'),
    (hosp_id, 'hosp_after_hours', 'After-hours premium (before 7AM / after 7PM)', 25, NULL, 'percentage', 'partner'),
    (hosp_id, 'hosp_weekend_flat', 'Weekend premium', 100, NULL, 'flat', 'standard'),
    (hosp_id, 'hosp_weekend_flat', 'Weekend premium', 100, NULL, 'flat', 'partner'),
    (hosp_id, 'hosp_multifloor', 'Multi-floor distribution (no elevator)', 50, NULL, 'per_flight', 'standard'),
    (hosp_id, 'hosp_multifloor', 'Multi-floor distribution (no elevator)', 50, NULL, 'per_flight', 'partner');

  UPDATE public.rate_card_templates
  SET template_kind = 'delivery', extras = '{}'::jsonb, updated_at = NOW()
  WHERE id = hosp_id;

  -- ========== MEDICAL & TECHNICAL ==========
  INSERT INTO public.rate_card_day_rates (template_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier) VALUES
    (med_id, 'sprinter', 750, 450, 6, 3, 'standard'),
    (med_id, 'sprinter', 950, 575, 5, 3, 'partner'),
    (med_id, '16ft', 900, 550, 5, 3, 'standard'),
    (med_id, '16ft', 1100, 650, 4, 2, 'partner'),
    (med_id, '20ft', 1400, 800, 4, 2, 'partner');

  INSERT INTO public.rate_card_delivery_rates (template_id, delivery_type, zone, price_min, price_max, pricing_tier) VALUES
    (med_id, 'med_equipment_small', 1, 125, NULL, 'standard'),
    (med_id, 'med_equipment_small', 1, 175, NULL, 'partner'),
    (med_id, 'med_equipment_medium', 1, 200, NULL, 'standard'),
    (med_id, 'med_equipment_medium', 1, 275, NULL, 'partner'),
    (med_id, 'med_equipment_large', 1, 350, NULL, 'standard'),
    (med_id, 'med_equipment_large', 1, 450, NULL, 'partner'),
    (med_id, 'med_equipment_heavy', 1, 500, NULL, 'standard'),
    (med_id, 'med_equipment_heavy', 1, 650, NULL, 'partner'),
    (med_id, 'med_server_rack', 1, 400, NULL, 'standard'),
    (med_id, 'med_server_rack', 1, 500, NULL, 'partner'),
    (med_id, 'med_imaging', 1, 0, NULL, 'standard'),
    (med_id, 'med_imaging', 1, 0, NULL, 'partner');

  INSERT INTO public.rate_card_services (template_id, service_slug, service_name, price_min, price_max, price_unit, pricing_tier) VALUES
    (med_id, 'med_chain_custody', 'Chain of custody documentation', 0, 0, 'included', 'standard'),
    (med_id, 'med_chain_custody', 'Chain of custody documentation', 0, 0, 'included', 'partner'),
    (med_id, 'med_condition', 'Condition report (photo/video)', 0, 0, 'included', 'standard'),
    (med_id, 'med_condition', 'Condition report (photo/video)', 0, 0, 'included', 'partner'),
    (med_id, 'med_disconnect', 'Equipment disconnection', 95, NULL, 'flat', 'standard'),
    (med_id, 'med_disconnect', 'Equipment disconnection', 95, NULL, 'flat', 'partner'),
    (med_id, 'med_reconnect', 'Equipment reconnection / calibration assist', 125, NULL, 'flat', 'standard'),
    (med_id, 'med_reconnect', 'Equipment reconnection / calibration assist', 125, NULL, 'flat', 'partner'),
    (med_id, 'med_climate', 'Climate-controlled transport', 150, NULL, 'flat', 'standard'),
    (med_id, 'med_climate', 'Climate-controlled transport', 150, NULL, 'flat', 'partner'),
    (med_id, 'med_stairs', 'Stairs (per flight)', 75, NULL, 'per_flight', 'standard'),
    (med_id, 'med_stairs', 'Stairs (per flight)', 75, NULL, 'per_flight', 'partner'),
    (med_id, 'med_after_hours', 'After-hours', 25, NULL, 'percentage', 'standard'),
    (med_id, 'med_after_hours', 'After-hours', 25, NULL, 'percentage', 'partner');

  UPDATE public.rate_card_templates
  SET template_kind = 'delivery', extras = '{}'::jsonb, updated_at = NOW()
  WHERE id = med_id;

  -- ========== REFERRAL (commission — no delivery tables) ==========
  UPDATE public.rate_card_templates
  SET
    template_kind = 'referral',
    extras = jsonb_build_object(
      'commission_structure', jsonb_build_object(
        'type', 'percentage',
        'rates', jsonb_build_object('essential', 0.05, 'signature', 0.07, 'estate', 0.10),
        'flat_rate', 75,
        'note', 'Choose percentage tiers or flat per referral when contracting.'
      ),
      'referral_terms', jsonb_build_object(
        'referral_code', 'Auto-generated (e.g. PARTNER-REF-XXXX)',
        'validity_days', 90,
        'payout_schedule', 'Monthly on billing anchor date',
        'minimum_payout', 50
      )
    ),
    updated_at = NOW()
  WHERE id = ref_id;

  -- ========== PROPERTY & PORTFOLIO ==========
  pm_extras := $PM$
  {
    "move_rates": [
      {"reason_code": "tenant_move_out", "label": "Tenant Move-Out", "studio": 449, "1br": 649, "2br": 849, "3br": 1199, "4br_plus": 1599},
      {"reason_code": "tenant_move_in", "label": "Tenant Move-In", "studio": 449, "1br": 649, "2br": 849, "3br": 1199, "4br_plus": 1599},
      {"reason_code": "reno_move_out", "label": "Renovation Displacement (out)", "studio": 349, "1br": 549, "2br": 749, "3br": 1099},
      {"reason_code": "reno_move_in", "label": "Renovation Return (in)", "studio": 349, "1br": 549, "2br": 749, "3br": 1099},
      {"reason_code": "suite_transfer", "label": "Suite Transfer (same building)", "studio": 249, "1br": 449, "2br": 649},
      {"reason_code": "emergency_relocation", "label": "Emergency Relocation", "studio": 549, "1br": 749, "2br": 949, "3br": 1299, "4br_plus": 1699},
      {"reason_code": "staging", "label": "Staging Move", "studio": 249, "1br": 449, "2br": 649},
      {"reason_code": "unit_turnover", "label": "Unit Turnover (clean + move)", "studio": 549, "1br": 749, "2br": 949, "3br": 1299}
    ],
    "surcharges": [
      {"label": "Weekend (Saturday/Sunday)", "value": "+$100"},
      {"label": "After-hours (before 8AM / after 6PM)", "value": "+15%"},
      {"label": "Statutory holiday", "value": "+$150"},
      {"label": "Mobilization (>30km from base)", "value": "$100/day"},
      {"label": "Mobilization waiver", "value": "3+ same-day moves at same property"},
      {"label": "Walk-up (no elevator) per flight", "value": "$50"},
      {"label": "Long carry (50m+)", "value": "$75"}
    ],
    "additional_services": [
      {"label": "Full packing service", "value": "From $300 (by unit size)"},
      {"label": "Packing materials kit", "value": "From $120 (by unit size)"},
      {"label": "Junk removal", "value": "From $150"},
      {"label": "Storage (per unit per day)", "value": "$45/day"},
      {"label": "Furniture disassembly/reassembly", "value": "Included"},
      {"label": "Floor protection", "value": "Included"},
      {"label": "Elevator padding", "value": "Included"}
    ],
    "volume_discounts": [
      {"label": "1–5 moves / month", "value": "Standard rates"},
      {"label": "6–15 moves", "value": "5% off all moves"},
      {"label": "16–30 moves", "value": "10% off all moves"},
      {"label": "30+ moves", "value": "Custom contract pricing"}
    ]
  }
  $PM$::jsonb;

  INSERT INTO public.rate_card_day_rates (template_id, vehicle_type, full_day_price, half_day_price, stops_included_full, stops_included_half, pricing_tier) VALUES
    (pm_id, '16ft_2crew', 750, 450, 8, 4, 'standard'),
    (pm_id, '20ft_3crew', 1050, 625, 8, 4, 'standard'),
    (pm_id, '26ft_4crew', 1400, 800, 8, 4, 'standard'),
    (pm_id, '16ft_2crew', 750, 450, 8, 4, 'partner'),
    (pm_id, '20ft_3crew', 1050, 625, 8, 4, 'partner'),
    (pm_id, '26ft_4crew', 1400, 800, 8, 4, 'partner');

  INSERT INTO public.rate_card_volume_bonuses (template_id, min_deliveries, max_deliveries, discount_pct) VALUES
    (pm_id, 1, 5, 0),
    (pm_id, 6, 15, 5),
    (pm_id, 16, 30, 10),
    (pm_id, 31, NULL, 0);

  UPDATE public.rate_card_templates
  SET template_kind = 'property_portfolio', extras = pm_extras, updated_at = NOW()
  WHERE id = pm_id;
END $$;

-- Align PM contract row defaults with portfolio template surcharges (new + existing active rows)
ALTER TABLE public.pm_rate_cards
  ALTER COLUMN weekend_surcharge SET DEFAULT 100;
ALTER TABLE public.pm_rate_cards
  ALTER COLUMN after_hours_premium SET DEFAULT 0.15;
ALTER TABLE public.pm_rate_cards
  ALTER COLUMN holiday_surcharge SET DEFAULT 150;

UPDATE public.pm_rate_cards
SET
  weekend_surcharge = 100,
  after_hours_premium = 0.15,
  holiday_surcharge = 150
WHERE active = TRUE;
