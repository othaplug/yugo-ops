-- Update generate_recurring_deliveries to include crew_id from schedule when creating deliveries.

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
      SELECT 1 FROM public.deliveries
      WHERE organization_id = r.organization_id
        AND scheduled_date = v_target_date
        AND status = 'draft'
        AND notes LIKE '%recurring_schedule_id:' || r.id || '%'
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
        crew_id
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
        'recurring_schedule',
        r.crew_id
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
