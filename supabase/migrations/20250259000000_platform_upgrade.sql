-- Platform upgrade: coordinator, payment tracking, notifications

ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS coordinator_name TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS payment_marked_paid BOOLEAN DEFAULT false;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS payment_marked_paid_at TIMESTAMPTZ;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS payment_marked_paid_by TEXT;

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  icon TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_user ON public.admin_notifications (user_id, read, created_at DESC);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform users manage notifications" ON public.admin_notifications;
CREATE POLICY "Platform users manage notifications"
  ON public.admin_notifications FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
