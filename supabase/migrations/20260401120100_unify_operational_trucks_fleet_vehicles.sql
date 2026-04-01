-- Unify operational truck references with fleet_vehicles. Safe when public.trucks is already dropped
-- (no-op). Equipment tables are optional (may not exist if b2b equipment migration was never applied).
--
-- Version 20260401120100 (not 20260401120000) to avoid colliding with notifications_from_opsplus_co.
--
-- If linked `db push` fails with "schema_migrations_pkey" / duplicate version 20260331120000, the remote
-- still lists that old migration while this repo no longer ships that file. Run once:
--   npx supabase migration repair --status reverted 20260331120000 --linked
-- then `npm run db:push` again.

ALTER TABLE public.fleet_vehicles ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE OR REPLACE FUNCTION public.__yugo_apply_truck_fleet_merge () RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  r RECORD;
  r2 RECORD;
  new_id UUID;
  plate TEXT;
  suffix INT;
BEGIN
  IF to_regclass ('public.trucks') IS NULL THEN
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS public.__tmp_truck_fv_merge (
    old_id UUID PRIMARY KEY,
    fv_id UUID NOT NULL REFERENCES public.fleet_vehicles (id) ON DELETE CASCADE
  );

  TRUNCATE public.__tmp_truck_fv_merge;

  INSERT INTO public.__tmp_truck_fv_merge (old_id, fv_id)
  SELECT DISTINCT ON (t.id)
    t.id,
    fv.id
  FROM public.trucks t
  INNER JOIN public.fleet_vehicles fv ON lower(trim(fv.display_name)) = lower(trim(t.name))
  ORDER BY t.id, fv.id;

  FOR r IN
    SELECT t.*
    FROM public.trucks t
    WHERE NOT EXISTS (SELECT 1 FROM public.__tmp_truck_fv_merge m WHERE m.old_id = t.id)
  LOOP
    plate := 'LEG-' || upper(substr(md5(r.id::text), 1, 12));
    suffix := 0;
    WHILE EXISTS (SELECT 1 FROM public.fleet_vehicles fv WHERE fv.license_plate = plate) LOOP
      suffix := suffix + 1;
      plate := 'LEG-' || upper(substr(md5(r.id::text || suffix::text), 1, 12));
    END LOOP;

    INSERT INTO public.fleet_vehicles (
      vehicle_type,
      license_plate,
      display_name,
      capacity_cuft,
      capacity_lbs,
      status,
      phone
    )
    VALUES (
      'sprinter',
      plate,
      r.name,
      0,
      0,
      'active',
      r.phone
    )
    RETURNING id INTO new_id;

    INSERT INTO public.__tmp_truck_fv_merge (old_id, fv_id) VALUES (r.id, new_id);
  END LOOP;

  UPDATE public.fleet_vehicles fv
  SET phone = t.phone
  FROM public.__tmp_truck_fv_merge m
  JOIN public.trucks t ON t.id = m.old_id
  WHERE fv.id = m.fv_id
    AND (fv.phone IS NULL OR trim(fv.phone) = '')
    AND t.phone IS NOT NULL
    AND trim(t.phone) <> '';

  UPDATE public.registered_devices d
  SET truck_id = m.fv_id
  FROM public.__tmp_truck_fv_merge m
  WHERE d.truck_id = m.old_id;

  UPDATE public.device_setup_codes c
  SET truck_id = m.fv_id
  FROM public.__tmp_truck_fv_merge m
  WHERE c.truck_id = m.old_id;

  UPDATE public.truck_assignments a
  SET truck_id = m.fv_id
  FROM public.__tmp_truck_fv_merge m
  WHERE a.truck_id = m.old_id;

  UPDATE public.readiness_checks rc
  SET truck_id = m.fv_id
  FROM public.__tmp_truck_fv_merge m
  WHERE rc.truck_id = m.old_id;

  IF to_regclass ('public.truck_equipment') IS NOT NULL THEN
    UPDATE public.truck_equipment te
    SET truck_id = m.fv_id
    FROM public.__tmp_truck_fv_merge m
    WHERE te.truck_id = m.old_id;
  END IF;
  IF to_regclass ('public.equipment_checks') IS NOT NULL THEN
    UPDATE public.equipment_checks ec
    SET truck_id = m.fv_id
    FROM public.__tmp_truck_fv_merge m
    WHERE ec.truck_id = m.old_id;
  END IF;
  IF to_regclass ('public.equipment_incidents') IS NOT NULL THEN
    UPDATE public.equipment_incidents ei
    SET truck_id = m.fv_id
    FROM public.__tmp_truck_fv_merge m
    WHERE ei.truck_id = m.old_id;
  END IF;

  DELETE FROM public.truck_assignments a
  WHERE EXISTS (
    SELECT 1
    FROM public.truck_assignments b
    WHERE b.truck_id = a.truck_id
      AND b.date = a.date
      AND b.id < a.id
  );

  IF to_regclass ('public.truck_equipment') IS NOT NULL THEN
    DELETE FROM public.truck_equipment a
    WHERE EXISTS (
      SELECT 1
      FROM public.truck_equipment b
      WHERE b.truck_id = a.truck_id
        AND b.equipment_id = a.equipment_id
        AND b.id < a.id
    );
  END IF;

  FOR r2 IN
    SELECT c.conname, cl.relname AS tbl
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.trucks'::regclass
      AND n.nspname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r2.tbl, r2.conname);
  END LOOP;

  BEGIN
    ALTER TABLE public.registered_devices
      ADD CONSTRAINT registered_devices_truck_id_fkey
      FOREIGN KEY (truck_id) REFERENCES public.fleet_vehicles (id) ON DELETE SET NULL;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.device_setup_codes
      ADD CONSTRAINT device_setup_codes_truck_id_fkey
      FOREIGN KEY (truck_id) REFERENCES public.fleet_vehicles (id) ON DELETE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.truck_assignments
      ADD CONSTRAINT truck_assignments_truck_id_fkey
      FOREIGN KEY (truck_id) REFERENCES public.fleet_vehicles (id) ON DELETE CASCADE;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.readiness_checks
      ADD CONSTRAINT readiness_checks_truck_id_fkey
      FOREIGN KEY (truck_id) REFERENCES public.fleet_vehicles (id) ON DELETE SET NULL;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  IF to_regclass ('public.truck_equipment') IS NOT NULL THEN
    BEGIN
      EXECUTE $ddl$
        ALTER TABLE public.truck_equipment
        ADD CONSTRAINT truck_equipment_truck_id_fkey
        FOREIGN KEY (truck_id) REFERENCES public.fleet_vehicles (id) ON DELETE CASCADE
      $ddl$;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF to_regclass ('public.equipment_checks') IS NOT NULL THEN
    BEGIN
      EXECUTE $ddl$
        ALTER TABLE public.equipment_checks
        ADD CONSTRAINT equipment_checks_truck_id_fkey
        FOREIGN KEY (truck_id) REFERENCES public.fleet_vehicles (id) ON DELETE SET NULL
      $ddl$;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF to_regclass ('public.equipment_incidents') IS NOT NULL THEN
    BEGIN
      EXECUTE $ddl$
        ALTER TABLE public.equipment_incidents
        ADD CONSTRAINT equipment_incidents_truck_id_fkey
        FOREIGN KEY (truck_id) REFERENCES public.fleet_vehicles (id) ON DELETE SET NULL
      $ddl$;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;

  DROP TABLE IF EXISTS public.trucks;
  DROP TABLE IF EXISTS public.__tmp_truck_fv_merge;
END
$fn$;

SELECT public.__yugo_apply_truck_fleet_merge ();

DROP FUNCTION public.__yugo_apply_truck_fleet_merge ();
