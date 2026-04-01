-- B2B consolidation: calculated vs override vs final price; link delivery to source quote

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS calculated_price NUMERIC,
  ADD COLUMN IF NOT EXISTS override_price NUMERIC,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS source_quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_source_quote_id ON public.deliveries (source_quote_id)
  WHERE source_quote_id IS NOT NULL;

COMMENT ON COLUMN public.deliveries.calculated_price IS 'Dimensional engine / quoted subtotal before admin override';
COMMENT ON COLUMN public.deliveries.override_price IS 'Admin-set final amount when overriding calculated_price';
COMMENT ON COLUMN public.deliveries.override_reason IS 'Required when override_price is set';
COMMENT ON COLUMN public.deliveries.source_quote_id IS 'Quotes.id when this delivery was created from a B2B quote';

-- Backfill calculated from existing pricing columns
UPDATE public.deliveries
SET calculated_price = COALESCE(NULLIF(total_price, 0), quoted_price, 0)
WHERE calculated_price IS NULL
  AND (total_price IS NOT NULL OR quoted_price IS NOT NULL);

UPDATE public.deliveries
SET calculated_price = 0
WHERE calculated_price IS NULL;

-- Legacy admin adjustments → override (keep admin_adjusted_price for transition)
UPDATE public.deliveries d
SET
  override_price = d.admin_adjusted_price,
  override_reason = COALESCE(NULLIF(trim(COALESCE(d.admin_notes, '')), ''), 'Legacy admin_adjusted_price')
WHERE d.admin_adjusted_price IS NOT NULL
  AND d.override_price IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'final_price'
  ) THEN
    ALTER TABLE public.deliveries
      ADD COLUMN final_price NUMERIC
      GENERATED ALWAYS AS (COALESCE(override_price, calculated_price)) STORED;
  END IF;
END $$;

ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_override_reason_required;

ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_override_reason_required CHECK (
    override_price IS NULL
    OR (override_reason IS NOT NULL AND length(trim(override_reason)) > 0)
  );
