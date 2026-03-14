-- Residential (local) tier-based deposit rules — editable in Platform > Pricing > Deposit Rules
INSERT INTO public.platform_config (key, value, description) VALUES
  ('deposit_curated_pct', '10', 'Curated tier: deposit % of total'),
  ('deposit_curated_min', '150', 'Curated tier: minimum deposit $'),
  ('deposit_signature_pct', '15', 'Signature tier: deposit % of total'),
  ('deposit_signature_min', '250', 'Signature tier: minimum deposit $'),
  ('deposit_estate_pct', '25', 'Estate tier: deposit % of total'),
  ('deposit_estate_min', '500', 'Estate tier: minimum deposit $')
ON CONFLICT (key) DO NOTHING;
