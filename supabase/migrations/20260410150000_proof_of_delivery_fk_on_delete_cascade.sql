-- proof_of_delivery referenced deliveries/moves without ON DELETE behavior, so DELETE on
-- parent failed with proof_of_delivery_delivery_id_fkey / proof_of_delivery_move_id_fkey.

ALTER TABLE public.proof_of_delivery
  DROP CONSTRAINT IF EXISTS proof_of_delivery_delivery_id_fkey;

ALTER TABLE public.proof_of_delivery
  ADD CONSTRAINT proof_of_delivery_delivery_id_fkey
  FOREIGN KEY (delivery_id)
  REFERENCES public.deliveries(id)
  ON DELETE CASCADE;

ALTER TABLE public.proof_of_delivery
  DROP CONSTRAINT IF EXISTS proof_of_delivery_move_id_fkey;

ALTER TABLE public.proof_of_delivery
  ADD CONSTRAINT proof_of_delivery_move_id_fkey
  FOREIGN KEY (move_id)
  REFERENCES public.moves(id)
  ON DELETE CASCADE;
