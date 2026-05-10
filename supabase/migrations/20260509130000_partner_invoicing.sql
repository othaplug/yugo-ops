-- Partner invoicing infrastructure
--
-- 1. partner_invoices — one invoice per billing cycle per PM org
-- 2. moves.invoice_id — FK linking a move to its invoice
-- 3. organizations billing columns — controls auto-billing behaviour

-- ── 1. partner_invoices ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_invoices (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_number    text        NOT NULL,
  status            text        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  period_start      date        NOT NULL,
  period_end        date        NOT NULL,
  total_amount      numeric(12, 2) NOT NULL DEFAULT 0,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  sent_at           timestamptz,
  paid_at           timestamptz,
  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS partner_invoices_org_idx
  ON public.partner_invoices (organization_id);

CREATE INDEX IF NOT EXISTS partner_invoices_status_idx
  ON public.partner_invoices (status);

-- Row-level security (staff-only)
ALTER TABLE public.partner_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage partner invoices" ON public.partner_invoices;
CREATE POLICY "Staff can manage partner invoices"
  ON public.partner_invoices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_users pu
      WHERE pu.user_id = auth.uid()
        AND pu.role IN ('owner','admin','manager','coordinator','dispatcher','viewer','sales')
    )
  );

-- ── 2. moves.invoice_id ────────────────────────────────────────────────────
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS invoice_id uuid
    REFERENCES public.partner_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS moves_invoice_id_idx
  ON public.moves (invoice_id)
  WHERE invoice_id IS NOT NULL;

-- ── 3. organizations billing columns ───────────────────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_email        text,
  ADD COLUMN IF NOT EXISTS billing_anchor_day   integer
    CHECK (billing_anchor_day BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS billing_enabled      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_terms_days   integer NOT NULL DEFAULT 30;
