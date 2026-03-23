-- Card on file infrastructure: partner card columns + platform_config seeds
-- for processing recovery rate and payment method mode.

-- ── Partners (organizations) ──────────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS square_customer_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS square_card_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS card_last_four TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS card_brand TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS card_on_file BOOLEAN NOT NULL DEFAULT FALSE;

-- ── platform_config seed rows ─────────────────────────────────────────────
INSERT INTO platform_config (key, value, description, section)
VALUES
  ('processing_recovery_rate', '0.029',  'Credit card processing rate absorbed into tier prices (e.g. 0.029 = 2.9%). Applied before rounding.',                   'payment'),
  ('processing_recovery_flat', '0.30',   'Flat processing recovery per transaction in dollars (e.g. 0.30). Applied before rounding.',                              'payment'),
  ('payment_method',           'card_only', 'Payment method mode. ''card_only'' = card on file required. ''card_and_etransfer'' = re-enable e-transfer as option.', 'payment')
ON CONFLICT (key) DO NOTHING;
