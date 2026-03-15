-- Update tier multipliers: Signature 1.35 → 1.50, Estate 1.85 → 3.15
UPDATE public.platform_config
  SET value = '1.50'
  WHERE key = 'tier_signature_multiplier';

UPDATE public.platform_config
  SET value = '3.15'
  WHERE key = 'tier_estate_multiplier';

-- If keys were created as tier_premier_multiplier / old names, ensure we have the new keys with correct values
INSERT INTO public.platform_config (key, value, description)
  VALUES
    ('tier_signature_multiplier', '1.50', 'Signature tier multiplier'),
    ('tier_estate_multiplier', '3.15', 'Estate tier multiplier')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
