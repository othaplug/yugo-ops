-- Ensure released valuation matches $0.60/lb (UI reads rate_per_pound from DB)
UPDATE public.valuation_tiers
SET
  rate_per_pound = 0.60,
  rate_description = '$0.60 per pound per article',
  damage_process = 'Reimburse at $0.60 per pound of damaged item'
WHERE tier_slug = 'released';
