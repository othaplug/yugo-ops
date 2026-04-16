-- Per-job truck allocation fees (client pricing). Code reads truck_fee_* via src/lib/pricing/truck-fees.ts

INSERT INTO public.platform_config (key, value, description)
VALUES
  ('truck_fee_sprinter', '80', 'Per-job truck allocation: Sprinter / cargo van'),
  ('truck_fee_16ft', '140', 'Per-job truck allocation: 16-foot truck'),
  ('truck_fee_20ft', '200', 'Per-job truck allocation: 20-foot truck'),
  ('truck_fee_24ft', '240', 'Per-job truck allocation: 24-foot truck'),
  ('truck_fee_26ft', '280', 'Per-job truck allocation: 26-foot truck')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = COALESCE(EXCLUDED.description, public.platform_config.description);
