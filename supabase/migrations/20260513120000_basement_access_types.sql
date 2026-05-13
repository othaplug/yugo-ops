-- Add basement access types to access_scores so pricing engine can surcharge them.
-- UI dropdowns include three basement variants:
--   basement          — interior basement (stairs to navigate, surcharge similar to walk-up 2nd)
--   basement_stairs   — dedicated stairwell to basement (heavier penalty)
--   basement_walkout  — exterior walk-out at grade level (no surcharge — equivalent to ground floor)

INSERT INTO public.access_scores (access_type, surcharge, notes) VALUES
  ('basement',          75,  'Interior basement — stairs to navigate items up/down'),
  ('basement_stairs',  100,  'Basement with dedicated stairwell (narrow/steep)'),
  ('basement_walkout',   0,  'Walk-out basement at grade level — no surcharge')
ON CONFLICT (access_type) DO UPDATE
  SET surcharge = EXCLUDED.surcharge,
      notes     = EXCLUDED.notes;
