-- deliveries.created_by_source: allow 'quote'.
--
-- The check constraint added by 20250319000000_recurring_delivery_cron.sql
-- restricts created_by_source to ('partner_portal', 'admin',
-- 'recurring_schedule'). But the B2B quote -> delivery converter
-- (src/lib/automations/create-delivery-from-b2b-quote.ts) writes
-- created_by_source = 'quote' to mark rows that came from a customer-
-- accepted quote (distinct from admin-created or partner-portal-
-- created deliveries).
--
-- Because of the mismatch, EVERY B2B one-off booking has been failing
-- the deliveries insert since that migration shipped. Square would
-- successfully charge the customer, the insert would throw, the
-- /api/payments/process handler would catch and return HTTP 500 with
-- "Payment was processed but delivery creation failed", the customer
-- would (reasonably) hit Pay again -- and Square would charge them a
-- SECOND time because the priorPaymentIdRaw guard had nothing to
-- find (the first attempt did set square_payment_id, but the failure
-- catch returns before the customer sees a recovery path).
--
-- 2026-06-29 surfaced by Oche on Jenny Belanger / YG-30337: $283
-- charged twice on Visa 2645, zero confirmations sent, zero delivery
-- row created. Same flaw was responsible for the "B2B bookings
-- silently fail" pattern that led someone to build
-- /api/admin/quotes/recover-move months ago.

ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_created_by_source_check;

ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_created_by_source_check
    CHECK (
      created_by_source IS NULL
      OR created_by_source IN (
        'partner_portal',
        'admin',
        'recurring_schedule',
        'quote'
      )
    );
