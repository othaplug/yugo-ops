-- Payment rules by service type
-- Controls deposit % vs full payment for each service type on the client quote page.
INSERT INTO platform_config (key, value, description)
VALUES (
  'payment_rules_by_type',
  '{"residential":{"deposit_type":"percentage","curated":0.10,"curated_min":150,"signature":0.15,"signature_min":250,"estate":0.25,"estate_min":500},"long_distance":{"deposit_type":"percentage","rate":0.25,"min":250},"office":{"deposit_type":"percentage","rate":0.25,"min":500},"office_move":{"deposit_type":"percentage","rate":0.25,"min":500},"single_item":{"deposit_type":"full_payment"},"white_glove":{"deposit_type":"percentage","rate":0.25,"min":250},"specialty":{"deposit_type":"percentage","rate":0.25,"min":250},"event":{"deposit_type":"percentage","rate":0.25,"min":300},"b2b_oneoff":{"deposit_type":"full_payment"},"b2b_delivery":{"deposit_type":"full_payment"},"labour_only":{"deposit_type":"percentage","rate":0.50,"min":200}}',
  'Deposit and payment rules per service type for the client quote page'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;
