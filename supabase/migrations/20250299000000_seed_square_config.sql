-- Seed Square payment config into platform_config as a reliable fallback.
-- These are public-facing client IDs (not secrets) used by the payment form SDK.
INSERT INTO platform_config (key, value) VALUES
  ('square_app_id', 'sq0idp-__xNbtGOtKbOEAuAwrNBGQ'),
  ('square_location_id', 'L8A1ETG4MBP0P')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
