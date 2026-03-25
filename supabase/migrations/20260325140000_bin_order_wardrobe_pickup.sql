-- Wardrobe return tracking + pickup checklist support for bin_orders

ALTER TABLE public.bin_orders
  ADD COLUMN IF NOT EXISTS wardrobe_boxes_provided INTEGER,
  ADD COLUMN IF NOT EXISTS wardrobe_boxes_returned INTEGER,
  ADD COLUMN IF NOT EXISTS pickup_condition TEXT;

COMMENT ON COLUMN public.bin_orders.wardrobe_boxes_provided IS 'Wardrobe boxes issued on move day (from bundle)';
COMMENT ON COLUMN public.bin_orders.wardrobe_boxes_returned IS 'Counted at pickup';
COMMENT ON COLUMN public.bin_orders.pickup_condition IS 'good | some_damaged | many_damaged — crew/admin at pickup';

INSERT INTO public.platform_config (key, value, description) VALUES
  ('bin_missing_bin_fee', '12', 'Fee per missing/damaged bin charged at pickup ($)')
ON CONFLICT (key) DO NOTHING;
