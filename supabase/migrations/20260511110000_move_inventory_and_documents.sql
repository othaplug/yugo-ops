-- Move detail systemic fixes (2026-05-11):
--   1) Persist quote inventory JSONB onto the move row directly so the move
--      detail UI can render parity with the quote without joining move_inventory.
--   2) Add proof-of-delivery + client-signature columns so the move Overview tab
--      can surface signed documents.
--   3) Backfill — copy inventory_items + score from each move's source quote.

-- ── 1. moves.inventory_items / inventory_score / assembly snapshot ────────────
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS inventory_items        JSONB,
  ADD COLUMN IF NOT EXISTS box_estimate           TEXT,
  ADD COLUMN IF NOT EXISTS assembly_required      BOOLEAN,
  ADD COLUMN IF NOT EXISTS assembly_override      BOOLEAN,
  ADD COLUMN IF NOT EXISTS assembly_items         JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assembly_minutes       INTEGER;

COMMENT ON COLUMN public.moves.inventory_items   IS 'Snapshot of quote.inventory_items at booking. Source of truth for move detail UI.';
COMMENT ON COLUMN public.moves.assembly_required IS 'Effective assembly flag — copied from quote (override beats auto-detection).';

-- ── 2. Proof-of-delivery columns (client signature on move complete) ─────────
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS pod_signature_url      TEXT,
  ADD COLUMN IF NOT EXISTS pod_signed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pod_signed_by_name     TEXT,
  ADD COLUMN IF NOT EXISTS pod_condition          TEXT,
  ADD COLUMN IF NOT EXISTS pod_photos             JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.moves.pod_signature_url IS 'Public URL of the client sign-off signature image captured at move completion.';
COMMENT ON COLUMN public.moves.pod_signed_at     IS 'When the client signed off on completion of the move.';

-- ── 3. Backfill: copy inventory snapshot from the source quote where missing ──
-- Quotes are linked by moves.quote_id (uuid → quotes.id) on this codebase.
UPDATE public.moves m
SET
  inventory_items   = COALESCE(m.inventory_items, q.inventory_items),
  inventory_score   = COALESCE(m.inventory_score, q.inventory_score),
  assembly_required = COALESCE(m.assembly_required, q.assembly_required),
  assembly_override = COALESCE(m.assembly_override, q.assembly_override),
  assembly_items    = COALESCE(NULLIF(m.assembly_items, '[]'::jsonb), q.assembly_items),
  assembly_minutes  = COALESCE(m.assembly_minutes, q.assembly_minutes)
FROM public.quotes q
WHERE m.quote_id IS NOT NULL
  AND m.quote_id = q.id
  AND (
    m.inventory_items IS NULL
    OR m.inventory_score IS NULL
    OR m.assembly_required IS NULL
  );
