-- Add readiness_items to platform_settings for configurable checklist
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS readiness_items JSONB DEFAULT '[
    {"label": "Truck in good condition"},
    {"label": "Equipment & supplies ready"},
    {"label": "Dolly, straps, blankets"},
    {"label": "First aid kit accessible"},
    {"label": "Fuel level adequate"}
  ]'::jsonb;
