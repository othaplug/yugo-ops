-- Labour rate validation outputs (post-pricing diagnostic; does not affect quote math)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS labour_rate_per_mover NUMERIC;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS labour_validation_status TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS labour_validation_message TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS labour_component NUMERIC;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS non_labour_component NUMERIC;

COMMENT ON COLUMN public.quotes.labour_rate_per_mover IS 'Implied $/hr per mover from post-hoc labour split (validation layer)';
COMMENT ON COLUMN public.quotes.labour_validation_status IS 'within_range | above_ceiling | below_floor | not_applicable';

-- Adjustable competitive bands (platform_config)
INSERT INTO public.platform_config (key, value, description) VALUES
  ('labour_rate_floor_essential', '50', 'Labour validation: Essential tier floor ($/hr per mover)'),
  ('labour_rate_ceiling_essential', '80', 'Labour validation: Essential tier ceiling ($/hr per mover)'),
  ('labour_rate_floor_signature', '55', 'Labour validation: Signature tier floor ($/hr per mover)'),
  ('labour_rate_ceiling_signature', '80', 'Labour validation: Signature tier ceiling ($/hr per mover)'),
  ('labour_rate_floor_estate', '60', 'Labour validation: Estate tier floor (tracked, not enforced)'),
  ('labour_rate_ceiling_estate', '150', 'Labour validation: Estate tier ceiling (tracked, not enforced)'),
  ('labour_rate_floor_white_glove', '60', 'Labour validation: White glove floor ($/hr per mover)'),
  ('labour_rate_ceiling_white_glove', '90', 'Labour validation: White glove ceiling ($/hr per mover)'),
  ('labour_rate_floor_specialty', '65', 'Labour validation: Specialty floor ($/hr per mover)'),
  ('labour_rate_ceiling_specialty', '90', 'Labour validation: Specialty ceiling ($/hr per mover)'),
  ('labour_rate_floor_event', '55', 'Labour validation: Event floor ($/hr per mover)'),
  ('labour_rate_ceiling_event', '90', 'Labour validation: Event ceiling ($/hr per mover)'),
  ('labour_rate_floor_labour_only', '50', 'Labour validation: Labour-only floor ($/hr per mover)'),
  ('labour_rate_ceiling_labour_only', '80', 'Labour validation: Labour-only ceiling ($/hr per mover)'),
  ('labour_rate_floor_b2b', '40', 'Labour validation: B2B floor ($/hr per mover)'),
  ('labour_rate_ceiling_b2b', '75', 'Labour validation: B2B ceiling ($/hr per mover)')
ON CONFLICT (key) DO NOTHING;
