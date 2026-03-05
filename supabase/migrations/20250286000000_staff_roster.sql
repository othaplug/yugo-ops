-- ══════════════════════════════════════════════════
-- Staff Roster — dynamic employee list replacing hardcoded ALL_CREW
-- ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.staff_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'mover' CHECK (role IN ('mover', 'driver', 'lead', 'specialist', 'coordinator', 'admin')),
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  deactivated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_roster_name ON public.staff_roster (LOWER(TRIM(name)));

-- Seed existing crew names
INSERT INTO public.staff_roster (name, role) VALUES
  ('Marcus', 'mover'),
  ('Devon', 'mover'),
  ('James', 'mover'),
  ('Olu', 'mover'),
  ('Ryan', 'mover'),
  ('Chris', 'mover'),
  ('Specialist', 'specialist'),
  ('Michael T.', 'mover'),
  ('Alex', 'mover'),
  ('Jordan', 'mover'),
  ('Sam', 'mover'),
  ('Taylor', 'mover')
ON CONFLICT DO NOTHING;
