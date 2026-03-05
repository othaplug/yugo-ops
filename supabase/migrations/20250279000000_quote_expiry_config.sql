-- Add configurable quote expiry days to platform_config
INSERT INTO public.platform_config (id, key, value, description)
VALUES (
  gen_random_uuid(),
  'quote_expiry_days',
  '7',
  'Number of days until a sent quote expires. Resets from send time.'
)
ON CONFLICT (key) DO NOTHING;
