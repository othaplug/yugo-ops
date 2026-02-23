-- Extra items: add approval flow (crew + client can request, admin approves)
ALTER TABLE public.extra_items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS requested_by TEXT NOT NULL DEFAULT 'crew'
    CHECK (requested_by IN ('crew', 'client'));

-- Make added_by nullable for client requests (client has no crew_member id)
ALTER TABLE public.extra_items
  ALTER COLUMN added_by DROP NOT NULL;

-- Add job_type for deliveries (extra_items currently uses job_id which can be move or delivery)
ALTER TABLE public.extra_items
  ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'move'
    CHECK (job_type IN ('move', 'delivery'));

CREATE INDEX IF NOT EXISTS idx_extra_items_status ON public.extra_items (job_id, status);
