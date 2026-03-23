-- Rich OpenWeather snapshot for Command Center + crew (temp, wind, road hints).
ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS weather_brief JSONB;

COMMENT ON COLUMN moves.weather_brief IS 'Daytime forecast snapshot for move date: temps, wind, visibility, road_conditions_note (from daily weather-alerts cron)';
