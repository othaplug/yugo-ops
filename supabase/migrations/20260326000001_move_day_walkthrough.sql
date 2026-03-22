-- Move-Day Inventory Walkthrough + Margin Targets
--
-- inventory_change_requests is normally created by 20260324001000_inventory_change_requests.sql.
-- If you run this file alone (e.g. SQL editor), the CREATE below ensures the table exists first.
-- Prefer: `supabase db push` so all migrations apply in order.

-- ─────────────────────────────────────────────────────────────
-- 0. Ensure base table exists (same shape as 20260324001000 — idempotent)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'admin_reviewing', 'approved', 'adjusted',
    'declined', 'client_confirming', 'confirmed', 'cancelled'
  )),
  items_added JSONB NOT NULL DEFAULT '[]'::jsonb,
  items_removed JSONB NOT NULL DEFAULT '[]'::jsonb,
  auto_calculated_delta NUMERIC NOT NULL DEFAULT 0,
  admin_adjusted_delta NUMERIC,
  admin_notes TEXT,
  decline_reason TEXT,
  original_subtotal NUMERIC,
  new_subtotal NUMERIC,
  additional_deposit_required NUMERIC NOT NULL DEFAULT 0,
  truck_assessment JSONB,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_change_requests_move_id
  ON public.inventory_change_requests (move_id);
CREATE INDEX IF NOT EXISTS idx_inventory_change_requests_status
  ON public.inventory_change_requests (status);
CREATE INDEX IF NOT EXISTS idx_inventory_change_requests_submitted_at
  ON public.inventory_change_requests (submitted_at DESC);

ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS pending_inventory_change_request_id UUID
  REFERENCES public.inventory_change_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_moves_pending_inventory_cr
  ON public.moves (pending_inventory_change_request_id)
  WHERE pending_inventory_change_request_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 1. inventory_change_requests — new columns for crew walkthroughs
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.inventory_change_requests
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'client'
    CHECK (source IN ('client', 'crew', 'admin')),
  ADD COLUMN IF NOT EXISTS move_phase TEXT DEFAULT 'pre_move'
    CHECK (move_phase IN (
      'pre_move', 'at_pickup', 'during_loading',
      'at_delivery', 'post_move'
    )),
  ADD COLUMN IF NOT EXISTS crew_walkthrough_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS walkthrough_photos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS items_matched INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_missing INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS items_extra INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_charged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS crew_notes TEXT,
  ADD COLUMN IF NOT EXISTS client_response TEXT
    CHECK (client_response IS NULL OR client_response IN (
      'approved', 'declined', 'approved_pending_payment'
    )),
  ADD COLUMN IF NOT EXISTS client_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS extras_declined_note TEXT;

-- ─────────────────────────────────────────────────────────────
-- 2. moves — walkthrough tracking columns
-- ─────────────────────────────────────────────────────────────

ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS walkthrough_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS walkthrough_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS walkthrough_crew_member TEXT,
  ADD COLUMN IF NOT EXISTS walkthrough_skipped BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS walkthrough_skip_reason TEXT;

-- ─────────────────────────────────────────────────────────────
-- 3. platform_config — margin targets + change request timing
-- ─────────────────────────────────────────────────────────────

INSERT INTO platform_config (key, value) VALUES
  ('margin_target_curated',         '40'),
  ('margin_target_signature',       '48'),
  ('margin_target_estate',          '55'),
  ('margin_warning_threshold',      '35'),
  ('margin_critical_threshold',     '25'),
  -- Change requests: remove 48hr restriction, allow up to 24hr post-completion
  ('change_request_min_hours_before_move', '0'),
  ('change_request_post_move_hours',       '24')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ─────────────────────────────────────────────────────────────
-- 4. Index for crew-submitted pending requests
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_inv_change_req_source_move
  ON inventory_change_requests (move_id, source, status);
