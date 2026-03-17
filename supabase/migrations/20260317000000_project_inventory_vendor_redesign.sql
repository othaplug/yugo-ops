-- Prompt 93: Designer Multi-Vendor Project Flow
-- Adds vendor tracking, per-item status, room destination, and status log

-- ─── Vendor & tracking columns ────────────────────────────────────────────────
ALTER TABLE project_inventory
  ADD COLUMN IF NOT EXISTS vendor_name TEXT,
  ADD COLUMN IF NOT EXISTS vendor_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS vendor_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS vendor_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS vendor_order_number TEXT,
  ADD COLUMN IF NOT EXISTS vendor_pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS vendor_pickup_window TEXT,
  ADD COLUMN IF NOT EXISTS vendor_delivery_method TEXT,
  ADD COLUMN IF NOT EXISTS item_status TEXT DEFAULT 'ordered',
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_notes TEXT,
  ADD COLUMN IF NOT EXISTS room_destination TEXT,
  ADD COLUMN IF NOT EXISTS item_value NUMERIC,
  ADD COLUMN IF NOT EXISTS item_dimensions TEXT,
  ADD COLUMN IF NOT EXISTS requires_crating BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS requires_assembly BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS special_handling_notes TEXT;

-- Add CHECK constraints safely (skip if already exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_inventory_vendor_delivery_method_check'
  ) THEN
    ALTER TABLE project_inventory
      ADD CONSTRAINT project_inventory_vendor_delivery_method_check
      CHECK (vendor_delivery_method IN (
        'yugo_pickup', 'vendor_delivers_to_site',
        'vendor_delivers_to_warehouse', 'shipped_carrier', 'client_self'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_inventory_item_status_check'
  ) THEN
    ALTER TABLE project_inventory
      ADD CONSTRAINT project_inventory_item_status_check
      CHECK (item_status IN (
        'spec_selected', 'ordered', 'in_production',
        'ready_for_pickup', 'shipped', 'in_transit',
        'received_warehouse', 'inspected', 'stored',
        'scheduled_delivery', 'delivered', 'installed',
        'issue_reported'
      ));
  END IF;
END $$;

-- Backfill item_status from legacy status for existing records
UPDATE project_inventory
SET item_status = CASE status
  WHEN 'expected'               THEN 'ordered'
  WHEN 'shipped'                THEN 'shipped'
  WHEN 'received'               THEN 'received_warehouse'
  WHEN 'inspected'              THEN 'inspected'
  WHEN 'stored'                 THEN 'stored'
  WHEN 'scheduled_for_delivery' THEN 'scheduled_delivery'
  WHEN 'delivered'              THEN 'delivered'
  WHEN 'installed'              THEN 'installed'
  WHEN 'returned'               THEN 'issue_reported'
  WHEN 'damaged'                THEN 'issue_reported'
  ELSE 'ordered'
END
WHERE item_status IS NULL OR item_status = 'ordered';

-- Backfill vendor_name from vendor column for existing records
UPDATE project_inventory
SET vendor_name = vendor
WHERE vendor IS NOT NULL AND vendor_name IS NULL;

-- ─── Project status log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_status_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) NOT NULL,
  item_id     UUID REFERENCES project_inventory(id),
  old_status  TEXT,
  new_status  TEXT,
  changed_by  TEXT DEFAULT 'partner',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for project_status_log
ALTER TABLE project_status_log ENABLE ROW LEVEL SECURITY;

-- Allow admin service role full access
CREATE POLICY "admin_full_access_project_status_log"
  ON project_status_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
