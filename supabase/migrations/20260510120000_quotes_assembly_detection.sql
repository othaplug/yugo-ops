-- Assembly auto-detection columns on quotes
--
-- assembly_required      — effective value (auto-detected or manually set)
-- assembly_auto_detected — true when populated by item-intelligence, not manual
-- assembly_items         — array of item names that triggered detection
-- assembly_override      — coordinator manual override (null = use auto)
-- assembly_minutes       — total minutes estimated for assembly/disassembly

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS assembly_required      BOOLEAN  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assembly_auto_detected BOOLEAN  DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS assembly_items         JSONB    DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS assembly_override      BOOLEAN  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assembly_minutes       INTEGER  DEFAULT NULL;

COMMENT ON COLUMN public.quotes.assembly_required      IS 'Effective assembly flag — from auto-detection unless overridden';
COMMENT ON COLUMN public.quotes.assembly_auto_detected IS 'True when assembly_required was set by item-intelligence detection';
COMMENT ON COLUMN public.quotes.assembly_items         IS 'JSON array of item names that triggered assembly detection';
COMMENT ON COLUMN public.quotes.assembly_override      IS 'NULL = use auto-detection; TRUE/FALSE = coordinator manual override';
COMMENT ON COLUMN public.quotes.assembly_minutes       IS 'Total estimated assembly + disassembly minutes (feeds hours estimate)';
