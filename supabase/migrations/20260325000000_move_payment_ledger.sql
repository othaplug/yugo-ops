-- Ledger of discrete payments toward a move (deposit, balance, inventory adjustment, etc.)
-- moves.total_paid = cumulative recognized amount (pre-tax line + HST) from settled ledger entries

CREATE TABLE IF NOT EXISTS public.move_payment_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES public.moves(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('deposit', 'balance', 'inventory_change', 'adjustment')),
  label TEXT NOT NULL,
  pre_tax_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  hst_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  square_payment_id TEXT,
  square_receipt_url TEXT,
  inventory_change_request_id UUID REFERENCES public.inventory_change_requests(id) ON DELETE SET NULL,
  settlement_method TEXT NOT NULL DEFAULT 'card'
    CHECK (settlement_method IN ('card', 'etransfer', 'auto-charge', 'client', 'admin')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_move_payment_ledger_move_id ON public.move_payment_ledger (move_id);
CREATE INDEX IF NOT EXISTS idx_move_payment_ledger_paid_at ON public.move_payment_ledger (paid_at DESC);

ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS total_paid NUMERIC(14, 2);

COMMENT ON COLUMN public.moves.total_paid IS 'Cumulative job payments recognized (pre-tax + HST per ledger lines); does not include card processing fees';

-- Approximate backfill: fully settled moves get total_paid = amount (matches existing job total field)
UPDATE public.moves m
SET total_paid = m.amount
WHERE m.total_paid IS NULL
  AND COALESCE(m.balance_amount, 0) <= 0
  AND (
    m.balance_paid_at IS NOT NULL
    OR m.payment_marked_paid = true
    OR LOWER(COALESCE(m.status, '')) = 'paid'
  );

ALTER TABLE public.move_payment_ledger ENABLE ROW LEVEL SECURITY;
