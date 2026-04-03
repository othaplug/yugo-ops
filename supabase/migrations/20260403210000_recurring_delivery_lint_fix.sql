-- Fix supabase db lint: generate_recurring_deliveries referenced missing deliveries.notes;
-- get_next_schedule_date had unused p_frequency. Ensure columns exist, link schedule by FK,
-- and keep notes/ilike fallback for legacy rows.

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS source_recurring_delivery_schedule_id UUID
    REFERENCES public.recurring_delivery_schedules (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deliveries_source_recurring_schedule
  ON public.deliveries (source_recurring_delivery_schedule_id)
  WHERE source_recurring_delivery_schedule_id IS NOT NULL;

-- Legacy cron rows: tie schedule from embedded marker in notes when possible
UPDATE public.deliveries d
SET source_recurring_delivery_schedule_id = sub.schedule_id
FROM (
  SELECT
    d2.id AS delivery_id,
    (regexp_match(d2.notes, 'recurring_schedule_id:([0-9a-f-]{36})', 'i'))[1]::uuid AS schedule_id
  FROM public.deliveries d2
  WHERE d2.source_recurring_delivery_schedule_id IS NULL
    AND d2.notes IS NOT NULL
    AND d2.notes ILIKE '%recurring_schedule_id:%'
) sub
WHERE d.id = sub.delivery_id
  AND sub.schedule_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.recurring_delivery_schedules r WHERE r.id = sub.schedule_id);

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
  -- Callers pass frequency but advance p_from_date themselves; PG forbids renaming params on REPLACE.
  PERFORM length(COALESCE(p_frequency, ''));

  LOOP
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

    SELECT EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.organization_id = r.organization_id
        AND d.scheduled_date = v_target_date
        AND d.status = 'draft'
        AND (
          d.source_recurring_delivery_schedule_id = r.id
          OR (
            d.notes IS NOT NULL
            AND d.notes LIKE '%recurring_schedule_id:' || r.id::text || '%'
          )
        )
    ) INTO v_delivery_exists;

    IF NOT v_delivery_exists THEN
      v_new_number := 'DLV-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

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
        created_by_source,
        crew_id,
        source_recurring_delivery_schedule_id
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
        'Auto-generated from recurring schedule. recurring_schedule_id:' || r.id::text,
        'recurring_schedule',
        r.crew_id,
        r.id
      );
    END IF;

    IF r.frequency = 'weekly' THEN
      v_next_date := public.get_next_schedule_date(r.days_of_week, r.frequency, v_target_date);
    ELSIF r.frequency = 'biweekly' THEN
      v_next_date := public.get_next_schedule_date(r.days_of_week, r.frequency, v_target_date + 7);
    ELSIF r.frequency = 'monthly' THEN
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
