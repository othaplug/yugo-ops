-- Widget form: items not on list + special handling (glass, marble, etc.)
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS other_items JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS special_handling TEXT;

COMMENT ON COLUMN public.quote_requests.other_items IS 'Custom items not in catalog: [{ "name": string, "qty": number }]';
COMMENT ON COLUMN public.quote_requests.special_handling IS 'Items needing special handling (glass, marble, fragile, etc.)';
