-- quotes.recommended_tier: allow 'priority' for office moves.
--
-- The tier rename migration (20260322100000_tier_rename_curated_to_essential.sql)
-- locked the check constraint to ('essential','signature','estate') -- the
-- three residential tier names. Office moves use a different ladder:
--   Essential / Signature / Priority
-- so any office quote with recommended_tier = 'priority' was being
-- rejected at insert with quotes_recommended_tier_check (23514).
--
-- That's why no office_move quotes appear in the prod DB despite the
-- engine, layout, and admin form all being mostly built -- the row
-- couldn't insert. Oche flagged 2026-06-29 ("we have a huge problem
-- with our office move quoting system"); root cause was this
-- constraint silently rejecting Priority-recommended office quotes.

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_recommended_tier_check;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_recommended_tier_check
    CHECK (
      recommended_tier IS NULL
      OR recommended_tier IN ('essential', 'signature', 'estate', 'priority')
    );

-- selected_tier — same set + 'custom' which historical rows use.
ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_selected_tier_check;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_selected_tier_check
    CHECK (
      selected_tier IS NULL
      OR selected_tier IN ('essential', 'signature', 'estate', 'priority', 'custom')
    );
