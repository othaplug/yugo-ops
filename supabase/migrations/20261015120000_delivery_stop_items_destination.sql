-- Per-item destination for multi-drop B2B deliveries.
--
-- Items on a pickup stop can now be routed to a specific DROP stop instead
-- of all defaulting to the single final destination. The column stays
-- nullable because:
--   - every pre-existing single-drop delivery leaves this null (the only
--     drop is implied), and
--   - the server defaults null to the first drop stop on reads so legacy
--     data keeps rendering correctly.
--
-- A FK to delivery_stops with ON DELETE SET NULL prevents a dangling
-- destination when a drop is deleted; the item just falls back to the
-- default (first drop).

ALTER TABLE delivery_stop_items
  ADD COLUMN IF NOT EXISTS destination_stop_id uuid
  REFERENCES delivery_stops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS delivery_stop_items_destination_stop_idx
  ON delivery_stop_items(destination_stop_id)
  WHERE destination_stop_id IS NOT NULL;
