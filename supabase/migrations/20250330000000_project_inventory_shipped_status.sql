-- Add 'shipped' status for vendor-direct / other-carrier items (expected → shipped → delivered)
ALTER TABLE public.project_inventory DROP CONSTRAINT IF EXISTS project_inventory_status_check;
ALTER TABLE public.project_inventory ADD CONSTRAINT project_inventory_status_check CHECK (status IN (
  'expected', 'shipped', 'received', 'inspected', 'stored',
  'scheduled_for_delivery', 'delivered', 'installed',
  'returned', 'damaged'
));
