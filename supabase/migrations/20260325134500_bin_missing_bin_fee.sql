-- Missing-bin replacement fee at pickup (per spec; crew checklist / charges)
INSERT INTO public.platform_config (key, value, description) VALUES
  ('bin_missing_bin_fee', '12', 'Fee per bin not returned at pickup — replacement cost ($)')
ON CONFLICT (key) DO NOTHING;
