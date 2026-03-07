-- ══════════════════════════════════════════════════
-- Unified in-app notifications table
-- Replaces admin_notifications + partner_notifications
-- ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  event_slug TEXT,
  -- references notification_events.event_slug when created via dispatch

  title TEXT NOT NULL,
  body TEXT,
  icon TEXT DEFAULT 'bell',

  link TEXT,
  -- URL to navigate to when clicked

  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  source_type TEXT,
  -- 'delivery', 'move', 'quote', 'claim', 'payment', 'system'
  source_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_in_app_notif_user_unread
  ON public.in_app_notifications (user_id, is_read)
  WHERE is_read = FALSE;

CREATE INDEX idx_in_app_notif_user_created
  ON public.in_app_notifications (user_id, created_at DESC);

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_notifications"
  ON public.in_app_notifications FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enable Realtime so the bell component gets instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;
