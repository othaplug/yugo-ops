-- Inventory verification: crew checks off items at loading/unloading
CREATE TABLE IF NOT EXISTS public.inventory_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('move', 'delivery')),
  move_inventory_id UUID REFERENCES public.move_inventory(id) ON DELETE CASCADE,
  room TEXT,
  item_name TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('loading', 'unloading')),
  verified_at TIMESTAMPTZ DEFAULT now(),
  verified_by UUID NOT NULL REFERENCES public.crew_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_verifications_job ON public.inventory_verifications (job_id, job_type);

ALTER TABLE public.inventory_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform users manage inventory_verifications" ON public.inventory_verifications;
CREATE POLICY "Platform users manage inventory_verifications"
  ON public.inventory_verifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
