-- Remediation: remotes that missed 20260406190100 lose PostgREST "override_by" (schema cache errors).
-- quote_engagement.quote_id had no ON DELETE CASCADE, blocking admin quote deletes.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS system_price NUMERIC,
  ADD COLUMN IF NOT EXISTS override_price NUMERIC,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_by UUID;

COMMENT ON COLUMN public.quotes.system_price IS 'Pre-tax price from the pricing engine before coordinator override.';
COMMENT ON COLUMN public.quotes.override_price IS 'Pre-tax price when coordinator override is applied; NULL when not overridden.';
COMMENT ON COLUMN public.quotes.override_reason IS 'Required explanation when override_price is set.';
COMMENT ON COLUMN public.quotes.override_by IS 'Auth user id of coordinator who applied the override.';

ALTER TABLE public.quote_engagement
  DROP CONSTRAINT IF EXISTS quote_engagement_quote_id_fkey;

ALTER TABLE public.quote_engagement
  ADD CONSTRAINT quote_engagement_quote_id_fkey
  FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;
