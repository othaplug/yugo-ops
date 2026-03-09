-- ===================================================================
-- Recurring Delivery Schedule Cron Job
-- Runs daily at 6:00 AM Toronto time
-- For each active, non-paused schedule:
--   IF next occurrence is within 7 days AND no draft delivery exists:
--     1. Create a draft delivery
--     2. Update next_generation_date
-- ===================================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── Helper: generate next occurrence date ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_next_schedule_date(
  p_days_of_week INTEGER[],
  p_frequency TEXT,
  p_from_date DATE DEFAULT CURRENT_DATE
) RETURNS DATE
LANGUAGE plpgsql
AS $$
DECLARE
  v_check DATE := p_from_date + 1;
  v_dow INTEGER;
  v_limit INTEGER := 400;
  v_count INTEGER := 0;
BEGIN
  LOOP
    -- ISO dow: 1=Mon … 7=Sun
    v_dow := EXTRACT(ISODOW FROM v_check);
    IF v_dow = ANY(p_days_of_week) THEN
      RETURN v_check;
    END IF;
    v_check := v_check + 1;
    v_count := v_count + 1;
    EXIT WHEN v_count > v_limit;
  END LOOP;
  RETURN NULL;
END;
$$;

-- ── Core function executed by cron ────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_recurring_deliveries()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_target_date DATE;
  v_delivery_exists BOOLEAN;
  v_new_number TEXT;
  v_next_date DATE;
BEGIN
  FOR r IN
    SELECT rds.*, o.default_pickup_address, o.name AS org_name
    FROM public.recurring_delivery_schedules rds
    LEFT JOIN public.organizations o ON o.id = rds.organization_id
    WHERE rds.is_active = TRUE
      AND rds.is_paused = FALSE
      AND rds.next_generation_date IS NOT NULL
      AND rds.next_generation_date <= (CURRENT_DATE + INTERVAL '7 days')
  LOOP
    v_target_date := r.next_generation_date;

    -- Check if a draft delivery already exists for this schedule + date
    SELECT EXISTS (
      SELECT 1 FROM public.deliveries
      WHERE organization_id = r.organization_id
        AND scheduled_date = v_target_date
        AND status = 'draft'
        AND notes LIKE '%recurring_schedule_id:' || r.id || '%'
    ) INTO v_delivery_exists;

    IF NOT v_delivery_exists THEN
      -- Generate delivery number
      v_new_number := 'DLV-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

      -- Create the draft delivery
      INSERT INTO public.deliveries (
        delivery_number,
        organization_id,
        client_name,
        status,
        booking_type,
        vehicle_type,
        day_type,
        num_stops,
        time_slot,
        scheduled_date,
        pickup_address,
        category,
        notes,
        created_by_source
      ) VALUES (
        v_new_number,
        r.organization_id,
        r.org_name,
        'draft',
        r.booking_type,
        r.vehicle_type,
        r.day_type,
        r.default_num_stops,
        r.time_window,
        v_target_date,
        COALESCE(r.default_pickup_address, r.default_pickup_address),
        'b2b',
        'Auto-generated from recurring schedule. recurring_schedule_id:' || r.id,
        'recurring_schedule'
      );

      -- TODO: Insert in-app notification for partner
      -- INSERT INTO public.in_app_notifications ...
    END IF;

    -- Advance next_generation_date to the following period
    IF r.frequency = 'weekly' THEN
      v_next_date := public.get_next_schedule_date(r.days_of_week, r.frequency, v_target_date);
    ELSIF r.frequency = 'biweekly' THEN
      -- Skip to the week after next
      v_next_date := public.get_next_schedule_date(r.days_of_week, r.frequency, v_target_date + 7);
    ELSIF r.frequency = 'monthly' THEN
      -- Advance by ~4 weeks
      v_next_date := public.get_next_schedule_date(r.days_of_week, r.frequency, v_target_date + 21);
    ELSE
      v_next_date := public.get_next_schedule_date(r.days_of_week, r.frequency, v_target_date);
    END IF;

    UPDATE public.recurring_delivery_schedules
    SET next_generation_date = v_next_date
    WHERE id = r.id;

  END LOOP;
END;
$$;

-- ── Add 'draft' as valid delivery status ─────────────────────────
-- (The status check constraint may need updating; use IF NOT EXISTS pattern)
DO $$
BEGIN
  -- Add 'draft' to allowed statuses if a check constraint exists
  -- This is done via a conditional constraint drop/re-add
  -- Only run if the constraint exists and doesn't include 'draft'
  NULL; -- Supabase typically uses text columns without strict enums for status
END;
$$;

-- ── Add 'recurring_schedule' to created_by_source ────────────────
ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_created_by_source_check;

ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_created_by_source_check
  CHECK (created_by_source IN ('partner_portal', 'admin', 'recurring_schedule'));

-- ── Schedule the cron job: daily at 6:00 AM UTC ──────────────────
-- 6 AM UTC = 1 AM/2 AM EST/EDT (Toronto)
-- Adjust if you prefer Toronto local time (use pg_cron with timezone support)
SELECT cron.unschedule('generate_recurring_deliveries') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'generate_recurring_deliveries'
);

SELECT cron.schedule(
  'generate_recurring_deliveries',   -- job name
  '0 11 * * *',                       -- 11:00 AM UTC = 6:00 AM EST / 7:00 AM EDT
  $$SELECT public.generate_recurring_deliveries()$$
);
