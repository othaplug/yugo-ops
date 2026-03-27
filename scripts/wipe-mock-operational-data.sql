-- =============================================================================
-- WIPE MOCK / OPERATIONAL DATA (Supabase Postgres)
-- =============================================================================
--
-- Run in Supabase SQL Editor as a role that bypasses RLS (e.g. postgres / service),
-- or from repo: npm run db:wipe-mock   (requires: npx supabase link, Supabase CLI login)
-- Take a full backup first. Test with BEGIN; … ROLLBACK; before COMMIT.
--
-- PRESERVES (not truncated / deleted):
--   • platform_users          — admin / staff app access
--   • platform_settings
--   • platform_config
--   • email_templates
--   • Pricing & catalog: base_rates, neighbourhood_tiers, access_scores,
--     date_factors, specialty_surcharges, single_item_rates, addons,
--     deposit_rules, office_rates, rate_card_templates (+ template-linked rows),
--     truck_allocation_rules, item_weights, volume_benchmarks,
--     valuation_tiers, valuation_upgrades (seed pricing matrix)
--   • tier_features, duration_defaults
--   • notification_events (event-type catalog) + per-user prefs for platform_users only
--   • invitations (pending platform invites)
--   • Organizations row id = b0000000-0000-0000-0000-000000000001
--     (“_Rate Card Templates” system org from migrations) and its partner_rate_cards
--
-- DOES NOT TOUCH:
--   • auth.users (logins). Partner users lose org links when non-template orgs are removed;
--     delete test users separately in Auth if needed.
--   • HubSpot, Square, or other external APIs — this file only affects Postgres.
--
-- REMOVES:
--   • All fleet rows (fleet_vehicles, vehicle_maintenance_log), iPad trucks, devices,
--     setup codes, teams (crews), crew_members, tracking, crew portal artifacts
--   • Moves, deliveries, quotes, contacts, projects, claims, tips, ledgers, logs, etc.
--
-- AFTER RUN:
--   • Re-create real fleet_vehicles / trucks / teams in admin, or re-apply seed
--     fragments from supabase/migrations if you rely on default vehicle rows.
--   • Storage buckets (job-photos, etc.) may still contain old objects — clean in
--     Dashboard if required.
--
-- =============================================================================

BEGIN;

SET LOCAL statement_timeout = '600s';

-- ── 1) Unlink jobs from fleet, crews, statements, rate cards, projects ─────
UPDATE moves
SET
  assigned_truck_id = NULL,
  crew_id = NULL,
  quote_id = NULL
WHERE TRUE;

UPDATE deliveries
SET
  assigned_truck_id = NULL,
  crew_id = NULL,
  statement_id = NULL,
  rate_card_id = NULL,
  project_id = NULL,
  phase_id = NULL
WHERE TRUE;

UPDATE fleet_vehicles SET default_team_id = NULL WHERE default_team_id IS NOT NULL;

-- Declarations reference quotes/moves without enforced FK — clear before quote/move truncate
DELETE FROM high_value_declarations WHERE TRUE;

-- Invoices can reference moves and/or deliveries — clear before truncating those tables
DELETE FROM invoices WHERE TRUE;

DELETE FROM client_documents WHERE TRUE;

-- ── 2) Logs, feeds, cache, notifications (no business FK integrity needed) ─
DELETE FROM status_events;
DELETE FROM admin_notifications;
DELETE FROM webhook_logs;
DELETE FROM audit_log;
DELETE FROM sms_log;
DELETE FROM email_log;
DELETE FROM login_history lh
WHERE NOT EXISTS (
  SELECT 1 FROM platform_users pu WHERE pu.user_id = lh.user_id
);

-- Keep notification_events (catalog of event types); drop prefs except platform admins
DELETE FROM notification_preferences np
WHERE NOT EXISTS (
  SELECT 1 FROM platform_users pu WHERE pu.user_id = np.user_id
);

DELETE FROM in_app_notifications n
WHERE NOT EXISTS (
  SELECT 1 FROM platform_users pu WHERE pu.user_id = n.user_id
);
DELETE FROM push_subscriptions ps
WHERE NOT EXISTS (
  SELECT 1 FROM platform_users pu WHERE pu.user_id = ps.user_id
);
DELETE FROM eta_sms_log;
DELETE FROM routing_suggestions;
DELETE FROM widget_leads;
DELETE FROM messages;

-- Tables that may be missing if a migration was never applied on this project
DO $opt$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'distance_cache',
    'scope_changes',
    'calibration_suggestions',
    'address_intelligence',
    'crew_profiles',
    'scheduling_alternatives',
    'shipment_status_log',
    'inbound_shipments',
    'bin_orders',
    'gallery_project_items',
    'gallery_projects',
    'project_status_log',
    'partner_statements',
    'slack_message_events',
    'inventory_verifications',
    'email_verification_codes',
    'crew_lockout_attempts'
  ]
  LOOP
    BEGIN
      EXECUTE format('DELETE FROM %I', t);
    EXCEPTION
      WHEN SQLSTATE '42P01' THEN NULL;
    END;
  END LOOP;
END
$opt$;

-- ── 3) Partner notifications, referrals (core tables) ─────────────────────
DELETE FROM partner_notifications;

DELETE FROM quote_requests WHERE TRUE;

DELETE FROM partner_perks WHERE TRUE;
DELETE FROM perk_redemptions WHERE TRUE;
DELETE FROM client_referrals WHERE TRUE;

DELETE FROM realtors WHERE TRUE;
DELETE FROM referrals WHERE TRUE;

-- ── 5) Claims (children cascade from claims) ────────────────────────────────
DELETE FROM claims WHERE TRUE;

-- ── 6) Projects ─────────────────────────────────────────────────────────────
DELETE FROM project_timeline WHERE TRUE;
DELETE FROM project_inventory WHERE TRUE;
DELETE FROM project_phases WHERE TRUE;
DELETE FROM projects WHERE TRUE;

-- ── 7) Recurring schedules (before partner rate cards) ─────────────────────
DELETE FROM recurring_delivery_schedules WHERE TRUE;

-- ── 9) Crew / iPad / trucks — one CASCADE truncate ─────────────────────────
TRUNCATE TABLE
  location_updates,
  tracking_sessions,
  signoff_skips,
  crew_schedule_blocks,
  crew_location_history,
  crew_locations,
  job_photos,
  client_sign_offs,
  readiness_checks,
  crew_expenses,
  extra_items,
  end_of_day_reports,
  registered_devices,
  device_setup_codes,
  truck_assignments,
  crew_members,
  crews,
  trucks
RESTART IDENTITY CASCADE;

-- ── 10) Fleet ───────────────────────────────────────────────────────────────
-- vehicle_maintenance_log exists only after fleet upgrade migration
DO $blk$
BEGIN
  TRUNCATE TABLE vehicle_maintenance_log RESTART IDENTITY CASCADE;
EXCEPTION
  WHEN SQLSTATE '42P01' THEN NULL;
END
$blk$;

TRUNCATE TABLE fleet_vehicles RESTART IDENTITY CASCADE;

-- ── 11) Proof of delivery, incidents, reviews, inventory change flow ────────
DELETE FROM proof_of_delivery WHERE TRUE;
DELETE FROM incidents WHERE TRUE;
DELETE FROM review_requests WHERE TRUE;
DELETE FROM inventory_change_requests WHERE TRUE;

-- ── 12) Tips (references moves + crews; crews already empty) ───────────────
DELETE FROM tips WHERE TRUE;

-- ── 13) Moves + all FK-dependent rows (CASCADE) ─────────────────────────────
TRUNCATE TABLE moves RESTART IDENTITY CASCADE;

-- ── 14) Deliveries + delivery_stops (CASCADE) ───────────────────────────────
TRUNCATE TABLE deliveries RESTART IDENTITY CASCADE;

-- ── 15) Quotes (self-FK, if column exists) ──────────────────────────────────
DO $pq$
BEGIN
  UPDATE quotes SET parent_quote_id = NULL WHERE parent_quote_id IS NOT NULL;
EXCEPTION
  WHEN SQLSTATE '42703' THEN NULL;
END
$pq$;

-- Child tables (quote_events, quote_analytics, quote_engagement, …) cascade from quotes
TRUNCATE TABLE quotes RESTART IDENTITY CASCADE;

-- ── 16) Contacts (B2C quote contacts) ───────────────────────────────────────
TRUNCATE TABLE contacts RESTART IDENTITY CASCADE;

-- ── 17) Staff roster (field / ops roster — not platform_users) ─────────────
TRUNCATE TABLE staff_roster RESTART IDENTITY CASCADE;

-- ── 18) Partner rate data for real orgs only; keep template org cards ──────
DELETE FROM partner_rate_overrides
WHERE partner_id <> 'b0000000-0000-0000-0000-000000000001'::uuid;

DELETE FROM partner_rate_cards
WHERE organization_id <> 'b0000000-0000-0000-0000-000000000001'::uuid;

-- ── 19) Partner portal links + organizations (except template org) ──────────
DELETE FROM partner_users WHERE TRUE;

DELETE FROM organizations
WHERE id <> 'b0000000-0000-0000-0000-000000000001'::uuid;

-- Ensure template org row exists (e.g. DB never had migration seed). Rate card lines: run npm run db:seed-rate-template if partner_rate_cards is empty.
INSERT INTO public.organizations (id, name, type, notes)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  '_Rate Card Templates',
  'b2c',
  'System: holds rate card templates'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Review counts, then: COMMIT;   or   ROLLBACK;
-- =============================================================================

-- Example sanity checks (run after COMMIT if you like):
-- SELECT COUNT(*) FROM moves;
-- SELECT COUNT(*) FROM deliveries;
-- SELECT COUNT(*) FROM quotes;
-- SELECT COUNT(*) FROM organizations;
-- SELECT COUNT(*) FROM fleet_vehicles;
-- SELECT COUNT(*) FROM platform_users;

-- First run: use ROLLBACK instead of COMMIT to verify without persisting changes.
COMMIT;
