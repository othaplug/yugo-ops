-- Track cumulative amount received in cents for balance after bundle upgrades and add-on charges.
ALTER TABLE public.bin_orders ADD COLUMN IF NOT EXISTS paid_total_cents INTEGER;

COMMENT ON COLUMN public.bin_orders.paid_total_cents IS
  'Sum of successful Square charges in cents. Null means legacy row (treat as fully paid at current total until upgraded).';

UPDATE public.bin_orders
SET paid_total_cents = ROUND((total)::numeric * 100)::integer
WHERE payment_status = 'paid'
  AND paid_total_cents IS NULL;
