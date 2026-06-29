-- quotes.presentation_mode: allow office variants.
--
-- The 20260530220000 migration locked the constraint to
-- ('comparison', 'estate_featured', 'estate_only') — the three
-- residential presentation modes. The office quote studio adds the
-- parallel office modes:
--   priority_featured -- all three tiers visible, Priority gets the
--                        wine prominence (mirror of estate_featured)
--   priority_only     -- only the Priority card renders (mirror of
--                        estate_only)
-- Comparison stays as the default ("show all three side-by-side, no
-- one tier highlighted").
--
-- Operator ask 2026-06-29: complete redesign of the office quote
-- studio with admin-selected recommended tier + presentation mode.

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_presentation_mode_check;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_presentation_mode_check
    CHECK (
      presentation_mode IS NULL
      OR presentation_mode IN (
        'comparison',
        'estate_featured',
        'estate_only',
        'priority_featured',
        'priority_only'
      )
    );
