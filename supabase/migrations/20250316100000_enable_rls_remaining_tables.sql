-- ══════════════════════════════════════════════════
-- Enable RLS on all remaining public tables flagged by the Supabase linter.
-- Pattern: ENABLE RLS (idempotent) → DROP IF EXISTS → CREATE POLICY
-- Service-role (createAdminClient) bypasses RLS automatically.
-- ══════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. notifications  (legacy table — admin-only)
-- ─────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can manage notifications" ON public.notifications;
CREATE POLICY "Platform users can manage notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 2. change_requests  (legacy table — admin-only)
-- ─────────────────────────────────────────────
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can manage change_requests" ON public.change_requests;
CREATE POLICY "Platform users can manage change_requests"
  ON public.change_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 3. documents  (legacy table — admin-only)
-- ─────────────────────────────────────────────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can manage documents" ON public.documents;
CREATE POLICY "Platform users can manage documents"
  ON public.documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 4. trucks  (admin-only, accessed via service_role)
-- ─────────────────────────────────────────────
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can manage trucks" ON public.trucks;
CREATE POLICY "Platform users can manage trucks"
  ON public.trucks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 5. platform_settings  (backend-only, accessed via service_role)
-- ─────────────────────────────────────────────
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can read platform_settings" ON public.platform_settings;
CREATE POLICY "Platform users can read platform_settings"
  ON public.platform_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 6. notification_events  (reference data — authenticated read, admin write)
--    GET /api/admin/notifications uses createClient() for SELECT
-- ─────────────────────────────────────────────
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read notification_events" ON public.notification_events;
CREATE POLICY "Authenticated users can read notification_events"
  ON public.notification_events FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Platform users can manage notification_events" ON public.notification_events;
CREATE POLICY "Platform users can manage notification_events"
  ON public.notification_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 7. notification_preferences  (user-scoped read via createClient(),
--    writes handled by service_role in preferences PUT/POST)
-- ─────────────────────────────────────────────
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notification_preferences" ON public.notification_preferences;
CREATE POLICY "Users can read own notification_preferences"
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Platform users can manage notification_preferences" ON public.notification_preferences;
CREATE POLICY "Platform users can manage notification_preferences"
  ON public.notification_preferences FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 8. fleet_vehicles  (re-enable RLS — was set in 20250281 but linter
--    reports it as disabled; recreate policies idempotently)
-- ─────────────────────────────────────────────
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read fleet_vehicles" ON public.fleet_vehicles;
CREATE POLICY "Public read fleet_vehicles"
  ON public.fleet_vehicles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage fleet_vehicles" ON public.fleet_vehicles;
CREATE POLICY "Admins manage fleet_vehicles"
  ON public.fleet_vehicles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 9. vehicle_maintenance_log  (admin-only, accessed via service_role)
-- ─────────────────────────────────────────────
ALTER TABLE public.vehicle_maintenance_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can manage vehicle_maintenance_log" ON public.vehicle_maintenance_log;
CREATE POLICY "Platform users can manage vehicle_maintenance_log"
  ON public.vehicle_maintenance_log FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 10. staff_roster  (admin-only, accessed via service_role)
-- ─────────────────────────────────────────────
ALTER TABLE public.staff_roster ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can manage staff_roster" ON public.staff_roster;
CREATE POLICY "Platform users can manage staff_roster"
  ON public.staff_roster FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 11. email_templates  (manager+, accessed via service_role)
-- ─────────────────────────────────────────────
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform users can manage email_templates" ON public.email_templates;
CREATE POLICY "Platform users can manage email_templates"
  ON public.email_templates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 12. login_history  (user reads own rows; writes via service_role)
-- ─────────────────────────────────────────────
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own login_history" ON public.login_history;
CREATE POLICY "Users can read own login_history"
  ON public.login_history FOR SELECT TO authenticated
  USING (user_id = auth.uid());
