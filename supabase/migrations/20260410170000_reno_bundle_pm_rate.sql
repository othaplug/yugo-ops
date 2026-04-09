-- Bundle renovation (in + out) move reason and rate matrix rows for existing PM contracts

INSERT INTO public.pm_move_reasons (partner_id, reason_code, label, description, is_round_trip, default_origin, default_destination, requires_return_move, urgency_default, sort_order)
SELECT NULL, v.reason_code, v.label, v.description, v.is_round_trip, v.default_origin, v.default_destination, v.requires_return_move, v.urgency_default, v.sort_order
FROM (VALUES
  ('reno_bundle', 'Bundle Reno (In + Out)', 'Renovation bundle: coordinated move-out and move-in', true, 'unit', 'unit', true, 'standard', 45)
) AS v(reason_code, label, description, is_round_trip, default_origin, default_destination, requires_return_move, urgency_default, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pm_move_reasons g WHERE g.partner_id IS NULL AND g.reason_code = v.reason_code
);

INSERT INTO public.pm_rate_cards (contract_id, reason_code, unit_size, zone, base_rate, weekend_surcharge, active)
SELECT c.contract_id, 'reno_bundle', u.unit, 'local', u.base_amt, 200::numeric, true
FROM (SELECT DISTINCT contract_id FROM public.pm_rate_cards WHERE active = true) c
CROSS JOIN (VALUES
  ('studio', 799::numeric),
  ('1br', 1099::numeric),
  ('2br', 1549::numeric),
  ('3br', 2149::numeric),
  ('4br_plus', 2899::numeric)
) AS u(unit, base_amt)
ON CONFLICT (contract_id, reason_code, unit_size, zone) DO NOTHING;

INSERT INTO public.pm_contract_reason_codes (contract_id, reason_code, active)
SELECT DISTINCT c.contract_id, 'reno_bundle', true
FROM public.pm_contract_reason_codes c
WHERE c.active = true
ON CONFLICT (contract_id, reason_code) DO NOTHING;
