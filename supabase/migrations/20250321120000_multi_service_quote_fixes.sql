-- B2B invoice booking + labour storage weekly rate
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS payment_status TEXT;

INSERT INTO public.platform_config (key, value, description) VALUES
  ('storage_weekly_rate', '75', 'Estimated storage fee per week for labour-only quotes when storage between visits is selected')
ON CONFLICT (key) DO NOTHING;
