-- Optional extra route stops on a move, shown after the from -> to pair on
-- client documents (Move Summary / Invoice / Receipt).
--
-- A move stores a single from_address -> to_address pair, but some jobs run a
-- longer route (e.g. an event: pickup -> venue -> return/storage). This holds
-- the onward stop(s) after to_address as an ordered JSONB array of
-- { label, address }, so the route block can render the full chain. Empty by
-- default, so every existing move and document is unchanged.
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS additional_stops JSONB DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
