-- moves.tier_selected: allow 'priority' for office moves.
--
-- Mirror of the quotes_recommended_tier_check fix
-- (20260629140000_quotes_recommended_tier_allow_priority.sql) but on
-- the moves side. Without this, even after fixing the quote-level
-- constraint and the engine to produce tiers, the moment an office
-- Priority quote got accepted and converted to a move row, the
-- CHECK rejected priority and createMoveFromQuote silently nulled
-- tier_selected (see VALID_MOVE_TIERS in create-move-from-quote.ts).
-- The move would book but no tier ever surfaced anywhere downstream:
-- confirmation email, crew app, dispatch.

ALTER TABLE public.moves
  DROP CONSTRAINT IF EXISTS moves_tier_selected_check;

ALTER TABLE public.moves
  ADD CONSTRAINT moves_tier_selected_check
    CHECK (
      tier_selected IS NULL
      OR tier_selected IN ('essential', 'signature', 'estate', 'priority')
    );
