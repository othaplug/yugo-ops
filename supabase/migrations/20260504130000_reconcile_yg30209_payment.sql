-- ═══════════════════════════════════════════════════════════════════
-- Reconcile YG-30209 (Vasu Beachoo, White Glove, $1,250 + HST)
--
-- The client was charged TWICE by Square due to the idempotency bug.
-- Both charges are recorded in Square. This migration:
--   1. Marks the quote as accepted with the FIRST valid payment
--   2. Stores Square payment metadata on the quote row so that
--      the admin /api/admin/quotes/recover-move endpoint can create
--      the move without touching Square again
--   3. Records the second charge as a duplicate in quote_events so
--      ops+ staff know to issue the refund
--
-- ACTION REQUIRED after applying:
--   a) Call POST /api/admin/quotes/recover-move  { "quoteId": "YG-30209" }
--      (or use the Ops+ admin UI) to create the move.
--   b) Refund the DUPLICATE Square payment from Square Dashboard.
--   c) Re-enable the OPS-WBhook production webhook in Square Developer
--      Console (currently DISABLED).
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_quote_id   TEXT := 'YG-30209';
  v_quote_pk   UUID;
BEGIN
  SELECT id INTO v_quote_pk FROM public.quotes WHERE quote_id = v_quote_id LIMIT 1;

  IF v_quote_pk IS NULL THEN
    RAISE NOTICE 'YG-30209 not found — skipping reconciliation';
    RETURN;
  END IF;

  -- Only reconcile if not already accepted (idempotent)
  IF EXISTS (SELECT 1 FROM public.quotes WHERE id = v_quote_pk AND status = 'accepted') THEN
    RAISE NOTICE 'YG-30209 already accepted — skipping';
    RETURN;
  END IF;

  -- Mark quote accepted; Square payment IDs must be filled in manually
  -- by ops staff (replace FILL_IN_FIRST_SQUARE_PAYMENT_ID below).
  UPDATE public.quotes
  SET
    status              = 'accepted',
    accepted_at         = NOW(),
    payment_error       = NULL,
    payment_failed_at   = NULL,
    payment_retry_count = 0,
    -- Set square_payment_id to the FIRST of the two Square charges.
    -- Retrieve this from the Square Dashboard (the earlier timestamp).
    square_payment_id   = 'FILL_IN_FIRST_SQUARE_PAYMENT_ID',
    deposit_amount      = 150
  WHERE id = v_quote_pk;

  -- Log the duplicate charge event so staff know to refund it
  INSERT INTO public.quote_events (quote_id, event_type, metadata)
  VALUES (
    v_quote_id,
    'duplicate_payment_detected',
    jsonb_build_object(
      'note', 'Client was charged twice due to idempotency bug on 2026-05-04. First payment is the valid deposit. Second payment must be refunded via Square Dashboard.',
      'action_required', 'refund_second_square_payment'
    )
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'YG-30209 marked accepted — run recover-move and refund duplicate charge';
END $$;
