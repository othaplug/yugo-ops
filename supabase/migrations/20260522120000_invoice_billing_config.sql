-- Invoice billing config — banking details, contact emails, HST registration.
-- These keys are read by getInvoiceBillingContact() in src/lib/square-invoice-config.ts
-- and rendered into the Square invoice message body (e-transfer, credit card,
-- EFT / direct deposit blocks) and the HST line-item note (Registration: …).
--
-- Defaults in this migration MUST match DEFAULT_BILLING_CONTACT in
-- src/lib/square-invoice-builders.ts so dev and prod stay in sync. To change
-- a value, run an UPDATE on platform_config — do not edit code.

INSERT INTO platform_config (key, value, description) VALUES
  ('hst_registration_number', '777054038 RT0001',
    'CRA HST registration number — appears on every B2B / PM invoice''s HST line item note (required for ITC claims).'),
  ('billing_email', 'billing@helloyugo.com',
    'Billing contact email shown on invoices (payment-sent notifications, overdue reminders).'),
  ('etransfer_email', 'pay@helloyugo.com',
    'E-transfer payment email shown in the PAYMENT OPTIONS block on invoices.'),
  ('bank_name', 'RBC Royal Bank',
    'Bank name shown in the EFT / Direct Deposit block on invoices.'),
  ('bank_account_number', '1013408',
    'Bank account number for EFT / Direct Deposit.'),
  ('bank_transit_number', '02074',
    'Bank transit number for EFT / Direct Deposit.'),
  ('bank_institution_number', '003',
    'Bank institution number for EFT / Direct Deposit.'),
  ('office_address', '507 King Street East, Toronto, ON M5A 1M3',
    'HelloYugo Inc. office address shown in the EFT / Direct Deposit block.'),
  ('credit_card_fee_pct', '3.5',
    'Credit card processing fee percentage disclosed on invoices.')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;
