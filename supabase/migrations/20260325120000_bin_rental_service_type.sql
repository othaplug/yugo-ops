-- Bin rental as quote/move service type + inventory config + bin_orders pickup address

-- 1. Quotes: allow bin_rental
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_service_type_check;
ALTER TABLE quotes
  ADD CONSTRAINT quotes_service_type_check
  CHECK (service_type IN (
    'local_move', 'long_distance', 'office_move', 'single_item',
    'white_glove', 'specialty', 'event', 'b2b_delivery', 'labour_only',
    'bin_rental'
  ));

-- 2. Moves: allow bin_rental on service_type
ALTER TABLE moves DROP CONSTRAINT IF EXISTS moves_service_type_check;
ALTER TABLE moves
  ADD CONSTRAINT moves_service_type_check
  CHECK (
    service_type IS NULL
    OR service_type IN (
      'local_move',
      'long_distance',
      'office_move',
      'single_item',
      'white_glove',
      'specialty',
      'event',
      'b2b_delivery',
      'labour_only',
      'b2b_oneoff',
      'bin_rental'
    )
  );

-- 3. Moves: allow bin_rental move_type bucket
ALTER TABLE moves DROP CONSTRAINT IF EXISTS moves_move_type_check;
ALTER TABLE moves
  ADD CONSTRAINT moves_move_type_check
  CHECK (
    move_type IS NULL
    OR move_type IN (
      'residential',
      'office',
      'single_item',
      'white_glove',
      'specialty',
      'b2b_oneoff',
      'event',
      'labour_only',
      'bin_rental'
    )
  );

-- 4. bin_orders: pickup when different from delivery
ALTER TABLE public.bin_orders
  ADD COLUMN IF NOT EXISTS pickup_address TEXT;

COMMENT ON COLUMN public.bin_orders.pickup_address IS 'Where bins are collected; defaults to delivery_address when null';

-- 5. platform_config — pricing & inventory (new keys; existing bin_rental_* left for legacy)
INSERT INTO public.platform_config (key, value, description) VALUES
  ('bin_total_inventory', '500', 'Total plastic bins in fleet (capacity)'),
  ('bin_individual_price', '6', 'Price per extra or custom bin ($)'),
  ('bin_late_fee_per_day', '15', 'Late return fee per day ($)'),
  ('bin_delivery_charge', '20', 'Material delivery charge when not bundled with a Yugo move ($)'),
  ('bin_packing_paper_fee', '20', 'Packing paper add-on ($)'),
  ('bin_bundle_studio', '99', 'Studio bundle price ($)'),
  ('bin_bundle_1br', '179', '1BR bundle price ($)'),
  ('bin_bundle_2br', '279', '2BR bundle price ($)'),
  ('bin_bundle_3br', '399', '3BR bundle price ($)'),
  ('bin_bundle_4br_plus', '529', '4BR+ bundle price ($)'),
  ('bin_wardrobe_replacement_fee', '35', 'Wardrobe box not returned — per box ($)')
ON CONFLICT (key) DO NOTHING;
