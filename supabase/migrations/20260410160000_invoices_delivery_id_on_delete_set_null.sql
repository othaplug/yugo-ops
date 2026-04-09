-- invoices.delivery_id referenced deliveries without ON DELETE behavior, blocking DELETE on
-- deliveries (invoices_delivery_id_fkey). Match move_id: detach invoice rows instead of blocking.

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_delivery_id_fkey;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_delivery_id_fkey
  FOREIGN KEY (delivery_id)
  REFERENCES public.deliveries(id)
  ON DELETE SET NULL;
