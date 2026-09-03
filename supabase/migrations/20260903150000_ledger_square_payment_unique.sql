-- Prevent duplicate ledger rows for the same Square payment.
--
-- chargeApprovedFeeOnCard (extra items, add-ons, additional charges,
-- change-request fees) is idempotent on the CARD via a stable Square
-- idempotency key, but a lost-response retry or an exact-concurrency
-- double-submit could still insert a SECOND move_payment_ledger row for the
-- same square_payment_id — double-counting recorded revenue / total_paid.
--
-- The application now pre-checks for an existing row and treats a 23505 from
-- this index as "already recorded". This partial unique index is the
-- strongly-consistent backstop that makes the concurrency race impossible.
-- Partial (WHERE square_payment_id IS NOT NULL) so the many rows that carry no
-- Square id (external/offline settlements) are unaffected.
--
-- Safe to apply: a prod scan found zero existing duplicate square_payment_ids.

CREATE UNIQUE INDEX IF NOT EXISTS move_payment_ledger_square_payment_id_key
  ON public.move_payment_ledger (square_payment_id)
  WHERE square_payment_id IS NOT NULL;
