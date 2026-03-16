-- Add address field to project_phases so each phase can have its own delivery location
-- Also add shipped status to project_inventory for items in transit from vendor
ALTER TABLE public.project_phases ADD COLUMN IF NOT EXISTS address TEXT;
