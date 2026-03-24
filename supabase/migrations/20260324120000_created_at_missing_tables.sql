-- Add created_at to public base tables that don't already have created_at or create_date.
-- Existing rows receive the default at migration time.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.table_schema, t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = t.table_schema
          AND c.table_name = t.table_name
          AND c.column_name IN ('created_at', 'create_date')
      )
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.%I ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
        r.table_schema,
        r.table_name
      );
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Skip %.%: %', r.table_schema, r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- Support admin list default sort by newest first (where missing)
CREATE INDEX IF NOT EXISTS idx_moves_created_at_desc ON public.moves (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at_desc ON public.deliveries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at_desc ON public.organizations (created_at DESC);
