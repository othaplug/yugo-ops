-- Ensure weather alerts cron + Command Center weather run unless explicitly disabled.
-- Default ON: only skip when platform_config value is exactly 'false'.
INSERT INTO platform_config (key, value, description)
VALUES (
  'weather_alerts_enabled',
  'true',
  'When true, daily cron checks OpenWeather for rain/snow on move dates and sets moves.weather_alert'
)
ON CONFLICT (key) DO NOTHING;
