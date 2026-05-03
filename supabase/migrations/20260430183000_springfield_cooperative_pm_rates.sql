-- Springfield Co-Operative Homes Inc.: PM renovation rate card (PDF May 2026) + addons.
-- Applies to the partner portfolio contract + pm_rate_cards matrix; refreshes open PM move amounts where possible.

DO $$
DECLARE
  v_org   UUID;
  v_contract UUID;
  v_pack  numeric := 140;
BEGIN
  SELECT o.id INTO v_org
  FROM public.organizations o
  WHERE o.name ILIKE 'Springfield Co-Operative Homes Inc.%'
     OR o.name ILIKE 'Springfield Co-operative Homes Inc.%'
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE NOTICE 'Springfield Co-Operative Homes Inc. organization not found; migration skipped.';
    RETURN;
  END IF;

  SELECT c.id INTO v_contract
  FROM public.partner_contracts c
  WHERE c.partner_id = v_org
  ORDER BY
    CASE c.status WHEN 'active' THEN 0 WHEN 'negotiating' THEN 1 WHEN 'proposed' THEN 2 ELSE 9 END,
    c.created_at DESC
  LIMIT 1;

  IF v_contract IS NULL THEN
    RAISE NOTICE 'No partner_contract row for Springfield; migration skipped.';
    RETURN;
  END IF;

  -- Legacy JSON fallback (pricing + add-on scalars referenced by coordinators / tooling)
  UPDATE public.partner_contracts c
  SET rate_card = COALESCE(c.rate_card::jsonb, '{}'::jsonb)
    || jsonb_build_object(
      'reno_move_out', jsonb_build_object(
        'studio', 449, '1br', 599, '2br', 849, '3br', 1199, '4br_plus', 1599
      ),
      'renovation_move_out', jsonb_build_object(
        'studio', 449, '1br', 599, '2br', 849, '3br', 1199, '4br_plus', 1599
      ),
      'reno_move_in', jsonb_build_object(
        'studio', 399, '1br', 549, '2br', 799, '3br', 1099, '4br_plus', 1499
      ),
      'renovation_move_in', jsonb_build_object(
        'studio', 399, '1br', 549, '2br', 799, '3br', 1099, '4br_plus', 1499
      ),
      'reno_bundle', jsonb_build_object(
        'studio', 799, '1br', 1099, '2br', 1549, '3br', 2149, '4br_plus', 2899
      ),
      'weekend_surcharge', 100,
      'after_hours_premium', 0.15,
      'holiday_surcharge', 150,
      'packing_per_room', v_pack,
      'unpacking_per_room', v_pack,
      'assembly_per_item', 75
    )
  WHERE c.id = v_contract;

  -- Renovation weekday bases + PDF weekend deltas (bundle weekend varies by tier)
  INSERT INTO public.pm_rate_cards (
    contract_id, reason_code, unit_size, zone, base_rate, weekend_surcharge, active
  )
  VALUES
    (v_contract, 'reno_move_out', 'studio', 'local', 449, 100, true),
    (v_contract, 'reno_move_out', '1br', 'local', 599, 100, true),
    (v_contract, 'reno_move_out', '2br', 'local', 849, 100, true),
    (v_contract, 'reno_move_out', '3br', 'local', 1199, 100, true),
    (v_contract, 'reno_move_out', '4br_plus', 'local', 1599, 100, true),
    (v_contract, 'reno_move_in', 'studio', 'local', 399, 100, true),
    (v_contract, 'reno_move_in', '1br', 'local', 549, 100, true),
    (v_contract, 'reno_move_in', '2br', 'local', 799, 100, true),
    (v_contract, 'reno_move_in', '3br', 'local', 1099, 100, true),
    (v_contract, 'reno_move_in', '4br_plus', 'local', 1499, 100, true),
    (v_contract, 'reno_bundle', 'studio', 'local', 799, 170, true),
    (v_contract, 'reno_bundle', '1br', 'local', 1099, 200, true),
    (v_contract, 'reno_bundle', '2br', 'local', 1549, 200, true),
    (v_contract, 'reno_bundle', '3br', 'local', 2149, 200, true),
    (v_contract, 'reno_bundle', '4br_plus', 'local', 2899, 0, true)
  ON CONFLICT (contract_id, reason_code, unit_size, zone) DO UPDATE
  SET
    base_rate = EXCLUDED.base_rate,
    weekend_surcharge = EXCLUDED.weekend_surcharge,
    active = true;

  INSERT INTO public.pm_contract_reason_codes (contract_id, reason_code, active)
  SELECT v_contract, rc, true
  FROM unnest(ARRAY['reno_move_out', 'reno_move_in', 'reno_bundle']::text[]) AS t(rc)
  ON CONFLICT (contract_id, reason_code) DO UPDATE SET active = true;

  -- Add-on catalogue (partner portal addons API); flat / per-room / per-item where applicable
  INSERT INTO public.pm_contract_addons (contract_id, addon_code, label, price, price_type, active)
  VALUES
    (v_contract, 'packing_service', 'Packing service', v_pack, 'per_room', true),
    (v_contract, 'unpacking_service', 'Unpacking service', v_pack, 'per_room', true),
    (v_contract, 'assembly_complex', 'Assembly or disassembly (complex items)', 75, 'per_item', true),
    (v_contract, 'junk_small', 'Junk removal (small load)', 149, 'flat', true),
    (v_contract, 'junk_medium', 'Junk removal (medium load)', 299, 'flat', true),
    (v_contract, 'junk_large', 'Junk removal (large load)', 499, 'flat', true),
    (v_contract, 'stair_carry_flight', 'Stair carry (no elevator)', 50, 'per_unit', true),
    (v_contract, 'emergency_same_day_pct', 'Emergency or same-day service', 30, 'percentage', true)
  ON CONFLICT (contract_id, addon_code) DO UPDATE
  SET
    label = EXCLUDED.label,
    price = EXCLUDED.price,
    price_type = EXCLUDED.price_type,
    active = true;

END $$;

WITH src AS (
  SELECT
    m.id AS move_id,
    ROUND(
      pr.base_rate
      + CASE
          WHEN EXTRACT(ISODOW FROM COALESCE(m.scheduled_date::date, CURRENT_DATE))::int NOT IN (6, 7)
          THEN 0::numeric
          ELSE COALESCE(pr.weekend_surcharge, 100::numeric)
        END
      + CASE WHEN COALESCE(m.pm_packing_required, false)
          THEN COALESCE(
            (NULLIF(TRIM((crc.rate_card::jsonb ->> 'packing_per_room')), ''))::numeric,
            140::numeric
          )
          ELSE 0::numeric END
    ) AS new_amt
  FROM public.moves m
  INNER JOIN public.organizations o ON o.id = m.organization_id
    AND (
      o.name ILIKE 'Springfield Co-Operative Homes Inc.%'
      OR o.name ILIKE 'Springfield Co-operative Homes Inc.%'
    )
  INNER JOIN LATERAL (
    SELECT pc.rate_card AS rate_card, pc.id AS contract_id
    FROM public.partner_contracts pc
    WHERE pc.partner_id = m.organization_id
      AND pc.status IN ('active', 'negotiating', 'proposed')
    ORDER BY
      CASE pc.status WHEN 'active' THEN 0 WHEN 'negotiating' THEN 1 ELSE 2 END,
      pc.created_at DESC
    LIMIT 1
  ) crc ON true
  INNER JOIN public.pm_rate_cards pr ON pr.contract_id = crc.contract_id
    AND COALESCE(pr.active, true)
    AND pr.reason_code = m.pm_reason_code
    AND pr.unit_size = m.move_size
    AND pr.zone = COALESCE(NULLIF(TRIM(COALESCE(m.pm_zone, '')), ''), 'local')
  WHERE COALESCE(m.is_pm_move, false)
    AND NULLIF(TRIM(COALESCE(m.pm_reason_code, '')), '') IS NOT NULL
    AND NULLIF(TRIM(COALESCE(m.move_size, '')), '') IS NOT NULL
)
UPDATE public.moves m
SET
  estimate = src.new_amt,
  amount = src.new_amt
FROM src
WHERE m.id = src.move_id;

