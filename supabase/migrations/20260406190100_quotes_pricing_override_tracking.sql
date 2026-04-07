-- Track engine vs coordinator override for pricing diagnostics and reporting.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS system_price NUMERIC,
  ADD COLUMN IF NOT EXISTS override_price NUMERIC,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_by UUID;

COMMENT ON COLUMN public.quotes.system_price IS 'Pre-tax price from the pricing engine before coordinator override.';
COMMENT ON COLUMN public.quotes.override_price IS 'Pre-tax price when coordinator override is applied; NULL when not overridden.';
COMMENT ON COLUMN public.quotes.override_reason IS 'Required explanation when override_price is set.';
COMMENT ON COLUMN public.quotes.override_by IS 'Auth user id of coordinator who applied the override.';
