-- ===================================================================
-- Production Hardening Migration
-- RLS, indexes, updated_at triggers, tighter policies, bug fixes
-- ===================================================================

-- ===========================================
-- 1. Generic updated_at trigger function
-- ===========================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 2. Add updated_at triggers to core tables
-- ===========================================
DO $$ BEGIN
  CREATE TRIGGER set_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_crews_updated_at
    BEFORE UPDATE ON public.crews
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_moves_updated_at
    BEFORE UPDATE ON public.moves
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_deliveries_updated_at
    BEFORE UPDATE ON public.deliveries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_referrals_updated_at
    BEFORE UPDATE ON public.referrals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================
-- 3. Enable RLS on claims, projects, quote_requests
-- ===========================================
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_timeline ENABLE ROW LEVEL SECURITY;

-- Admin/staff can manage claims
DO $$ BEGIN
  CREATE POLICY "staff_manage_claims" ON public.claims
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public can insert claims (claim submission form)
DO $$ BEGIN
  CREATE POLICY "public_insert_claims" ON public.claims
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin/staff can manage claim_photos
DO $$ BEGIN
  CREATE POLICY "staff_manage_claim_photos" ON public.claim_photos
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public can insert claim_photos (during claim submission)
DO $$ BEGIN
  CREATE POLICY "public_insert_claim_photos" ON public.claim_photos
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin/staff can manage claim_timeline
DO $$ BEGIN
  CREATE POLICY "staff_manage_claim_timeline" ON public.claim_timeline
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin/staff can manage quote_requests
DO $$ BEGIN
  CREATE POLICY "staff_manage_quote_requests" ON public.quote_requests
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public can insert quote_requests (widget form)
DO $$ BEGIN
  CREATE POLICY "public_insert_quote_requests" ON public.quote_requests
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin/staff can manage projects
DO $$ BEGIN
  CREATE POLICY "staff_manage_projects" ON public.projects
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Partners can read their own projects
DO $$ BEGIN
  CREATE POLICY "partner_read_own_projects" ON public.projects
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.partner_users pu
        JOIN public.organizations o ON o.id = pu.org_id
        WHERE pu.user_id = auth.uid() AND projects.partner_id = o.id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin/staff can manage project_phases
DO $$ BEGIN
  CREATE POLICY "staff_manage_project_phases" ON public.project_phases
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin/staff can manage project_inventory
DO $$ BEGIN
  CREATE POLICY "staff_manage_project_inventory" ON public.project_inventory
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin/staff can manage project_timeline
DO $$ BEGIN
  CREATE POLICY "staff_manage_project_timeline" ON public.project_timeline
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator','dispatcher'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================
-- 4. Tighten overly permissive RLS policies
-- ===========================================

-- fleet_vehicles: restrict management to admins only
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins manage fleet_vehicles" ON public.fleet_vehicles;
  CREATE POLICY "staff_manage_fleet_vehicles" ON public.fleet_vehicles
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','dispatcher'))
    );
EXCEPTION WHEN undefined_table THEN NULL; WHEN others THEN NULL; END $$;

-- invitations: restrict to staff
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can manage invitations" ON public.invitations;
  CREATE POLICY "staff_manage_invitations" ON public.invitations
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager'))
    );
EXCEPTION WHEN undefined_table THEN NULL; WHEN others THEN NULL; END $$;

-- gallery_projects: restrict to staff + partner owners
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated can manage gallery_projects" ON public.gallery_projects;
  CREATE POLICY "staff_manage_gallery_projects" ON public.gallery_projects
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator'))
    );
EXCEPTION WHEN undefined_table THEN NULL; WHEN others THEN NULL; END $$;

-- quote_engagement_tracking: restrict reads to staff
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins read engagement" ON public.quote_engagement_tracking;
  CREATE POLICY "staff_read_engagement" ON public.quote_engagement_tracking
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.platform_users
        WHERE user_id = auth.uid() AND role IN ('owner','admin','manager','coordinator'))
    );
EXCEPTION WHEN undefined_table THEN NULL; WHEN others THEN NULL; END $$;

-- notification_events: users can only read their own
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read notification_events" ON public.notification_events;
  CREATE POLICY "users_read_own_notification_events" ON public.notification_events
    FOR SELECT USING (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN NULL; WHEN others THEN NULL; END $$;

-- ===========================================
-- 5. Fix COALESCE bug in recurring cron
-- ===========================================
-- The function spawn_recurring_deliveries has:
--   COALESCE(r.default_pickup_address, r.default_pickup_address)
-- which is a no-op. It should fall back to the org's address.
-- We fix this by replacing the function if it exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'spawn_recurring_deliveries') THEN
    -- Update the function body to fix the COALESCE
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.spawn_recurring_deliveries()
      RETURNS void AS $body$
      DECLARE
        r RECORD;
        o RECORD;
        new_date DATE;
        del_num TEXT;
        del_count INT;
      BEGIN
        FOR r IN
          SELECT rs.*, rs.id as schedule_id
          FROM public.recurring_delivery_schedules rs
          WHERE rs.is_active = TRUE
            AND rs.is_paused = FALSE
            AND rs.next_generation_date <= CURRENT_DATE
        LOOP
          SELECT * INTO o FROM public.organizations WHERE id = r.organization_id;

          SELECT COUNT(*) INTO del_count FROM public.deliveries WHERE organization_id = r.organization_id;
          del_num := 'DEL-' || LPAD((del_count + 1)::TEXT, 4, '0');

          INSERT INTO public.deliveries (
            organization_id, delivery_number, customer_name, delivery_address,
            pickup_address, items, status, scheduled_date, time_slot,
            category, notes, booking_type, vehicle_type, delivery_type
          ) VALUES (
            r.organization_id,
            del_num,
            COALESCE(r.default_customer_name, o.contact_name, o.name),
            COALESCE(r.default_delivery_address, ''),
            COALESCE(r.default_pickup_address, o.default_pickup_address, o.address, ''),
            COALESCE(r.default_items, '{}'),
            'scheduled',
            r.next_generation_date,
            COALESCE(r.default_time_slot, 'morning'),
            COALESCE(o.type, 'retail'),
            'Auto-generated from recurring schedule: ' || COALESCE(r.schedule_name, r.id::TEXT),
            COALESCE(r.default_booking_type, 'delivery'),
            COALESCE(r.default_vehicle_type, 'medium_truck'),
            COALESCE(r.default_delivery_type, 'standard')
          );

          new_date := CASE r.frequency
            WHEN 'daily' THEN r.next_generation_date + INTERVAL '1 day'
            WHEN 'weekly' THEN r.next_generation_date + INTERVAL '1 week'
            WHEN 'biweekly' THEN r.next_generation_date + INTERVAL '2 weeks'
            WHEN 'monthly' THEN r.next_generation_date + INTERVAL '1 month'
            ELSE r.next_generation_date + INTERVAL '1 week'
          END;

          IF r.end_date IS NOT NULL AND new_date > r.end_date THEN
            UPDATE public.recurring_delivery_schedules SET is_active = FALSE WHERE id = r.schedule_id;
          ELSE
            UPDATE public.recurring_delivery_schedules SET next_generation_date = new_date WHERE id = r.schedule_id;
          END IF;
        END LOOP;
      END;
      $body$ LANGUAGE plpgsql SECURITY DEFINER;
    $fn$;
  END IF;
END $$;

-- ===========================================
-- 6. Add missing indexes
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active_next
  ON public.recurring_delivery_schedules (is_active, is_paused, next_generation_date)
  WHERE is_active = TRUE AND is_paused = FALSE;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_pod_delivery_stop
    ON public.proof_of_delivery (delivery_id, delivery_stop_index);
EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_claims_move_id ON public.claims (move_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims (status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created ON public.quote_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_partner_id ON public.projects (partner_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON public.project_phases (project_id);

-- Deliveries indexes for common queries
CREATE INDEX IF NOT EXISTS idx_deliveries_org_status ON public.deliveries (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_scheduled_date ON public.deliveries (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_crew_date ON public.deliveries (crew_id, scheduled_date);

-- Moves indexes
CREATE INDEX IF NOT EXISTS idx_moves_org_id ON public.moves (organization_id);
CREATE INDEX IF NOT EXISTS idx_moves_crew_date ON public.moves (crew_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_moves_status ON public.moves (status);

-- Invoices index
CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON public.invoices (organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);

-- ===========================================
-- 7. Add updated_at + trigger to proof_of_delivery
-- ===========================================
DO $$ BEGIN
  ALTER TABLE public.proof_of_delivery ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  CREATE TRIGGER set_pod_updated_at
    BEFORE UPDATE ON public.proof_of_delivery
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;

-- ===========================================
-- 8. Add updated_at to crew_schedule_blocks
-- ===========================================
DO $$ BEGIN
  ALTER TABLE public.crew_schedule_blocks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  CREATE TRIGGER set_schedule_blocks_updated_at
    BEFORE UPDATE ON public.crew_schedule_blocks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;
