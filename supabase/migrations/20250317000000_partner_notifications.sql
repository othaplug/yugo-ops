-- Partner notifications table (mirrors admin_notifications for the partner portal)
CREATE TABLE IF NOT EXISTS public.partner_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  icon TEXT DEFAULT 'bell',
  link TEXT,
  read BOOLEAN DEFAULT false,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_notifications_org
  ON public.partner_notifications (org_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_notifications_user
  ON public.partner_notifications (user_id, read, created_at DESC);

ALTER TABLE public.partner_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner users read own org notifications"
  ON public.partner_notifications FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT pu.org_id FROM public.partner_users pu WHERE pu.user_id = auth.uid())
  );

CREATE POLICY "Partner users update own org notifications"
  ON public.partner_notifications FOR UPDATE TO authenticated
  USING (
    org_id IN (SELECT pu.org_id FROM public.partner_users pu WHERE pu.user_id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT pu.org_id FROM public.partner_users pu WHERE pu.user_id = auth.uid())
  );

-- Allow service-role inserts (admin creating notifications for partners) via admin client
-- No INSERT policy needed for authenticated partners; only admin/service-role inserts.
CREATE POLICY "Service role inserts partner notifications"
  ON public.partner_notifications FOR INSERT
  WITH CHECK (true);

-- Enable realtime for partner_notifications so partners get live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_notifications;
