-- Delivery day booking: add stop-level details, recommendation tracking
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS
  stops_detail JSONB DEFAULT '[]';

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS
  recommended_vehicle TEXT;

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS
  recommended_day_type TEXT;
