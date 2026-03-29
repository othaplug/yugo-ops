-- B2B vertical pricing integration: deliveries, RISSD, learning calibration

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS vertical_code TEXT,
  ADD COLUMN IF NOT EXISTS b2b_assembly_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS b2b_debris_removal BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS b2b_line_items JSONB;

COMMENT ON COLUMN public.deliveries.vertical_code IS 'delivery_verticals.code — B2B dimensional pricing profile for this job';

ALTER TABLE public.inbound_shipments
  ADD COLUMN IF NOT EXISTS vertical_code TEXT;

COMMENT ON COLUMN public.inbound_shipments.vertical_code IS 'B2B vertical for pricing when creating linked delivery (default furniture_retail)';

ALTER TABLE public.calibration_data
  ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vertical_code TEXT,
  ADD COLUMN IF NOT EXISTS handling_type TEXT;

CREATE INDEX IF NOT EXISTS idx_calibration_data_delivery_id ON public.calibration_data (delivery_id);
CREATE INDEX IF NOT EXISTS idx_calibration_data_vertical ON public.calibration_data (vertical_code) WHERE vertical_code IS NOT NULL;
