-- Claims & Damage Tracking + Widget Lead Capture tables

-- ═══════════════════════════════════════════════════
-- CLAIMS MANAGEMENT
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number TEXT NOT NULL UNIQUE,

  move_id UUID REFERENCES public.moves(id),
  delivery_id UUID REFERENCES public.deliveries(id),

  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,

  valuation_tier TEXT NOT NULL,
  was_upgraded BOOLEAN DEFAULT FALSE,

  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'under_review', 'approved', 'partially_approved',
    'denied', 'settled', 'closed'
  )),

  items JSONB NOT NULL DEFAULT '[]',
  total_claimed_value NUMERIC NOT NULL DEFAULT 0,

  assessed_by UUID REFERENCES auth.users(id),
  assessed_at TIMESTAMPTZ,
  assessment_notes TEXT,

  approved_amount NUMERIC,
  resolution_type TEXT CHECK (resolution_type IN (
    'repair', 'replacement', 'cash_settlement', 'denied', 'partial'
  )),
  resolution_notes TEXT,
  payout_method TEXT CHECK (payout_method IN (
    'e_transfer', 'credit_card_refund', 'cheque'
  )),
  payout_date DATE,
  payout_reference TEXT,

  crew_team TEXT,
  crew_members TEXT[],
  crew_notified BOOLEAN DEFAULT FALSE,

  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.claim_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type TEXT CHECK (photo_type IN (
    'damage', 'item_before', 'item_after', 'receipt', 'other'
  )),
  uploaded_by TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.claim_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_description TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate claim_number: CLM-0001, CLM-0002, etc.
CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(REPLACE(claim_number, 'CLM-', '') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.claims;
  NEW.claim_number := 'CLM-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claims_auto_number
  BEFORE INSERT ON public.claims
  FOR EACH ROW
  WHEN (NEW.claim_number IS NULL OR NEW.claim_number = '')
  EXECUTE FUNCTION public.generate_claim_number();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claims_updated_at
  BEFORE UPDATE ON public.claims
  FOR EACH ROW
  EXECUTE FUNCTION public.claims_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_move_id ON public.claims(move_id);
CREATE INDEX IF NOT EXISTS idx_claims_delivery_id ON public.claims(delivery_id);
CREATE INDEX IF NOT EXISTS idx_claims_client_email ON public.claims(client_email);
CREATE INDEX IF NOT EXISTS idx_claim_photos_claim_id ON public.claim_photos(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_timeline_claim_id ON public.claim_timeline(claim_id);

-- ═══════════════════════════════════════════════════
-- WIDGET LEAD CAPTURE
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_number TEXT NOT NULL UNIQUE,

  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'widget',

  move_size TEXT NOT NULL,
  from_postal TEXT NOT NULL,
  to_postal TEXT NOT NULL,
  move_date DATE,
  flexible_date BOOLEAN DEFAULT FALSE,

  widget_estimate_low NUMERIC,
  widget_estimate_high NUMERIC,
  estimate_factors TEXT[],

  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'contacted', 'quote_sent', 'booked', 'lost'
  )),

  contact_id UUID REFERENCES public.contacts(id),
  quote_id UUID REFERENCES public.quotes(id),
  hubspot_deal_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-generate lead_number: WL-001, WL-002, etc.
CREATE OR REPLACE FUNCTION public.generate_lead_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(REPLACE(lead_number, 'WL-', '') AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM public.quote_requests;
  NEW.lead_number := 'WL-' || LPAD(next_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quote_requests_auto_number
  BEFORE INSERT ON public.quote_requests
  FOR EACH ROW
  WHEN (NEW.lead_number IS NULL OR NEW.lead_number = '')
  EXECUTE FUNCTION public.generate_lead_number();

CREATE OR REPLACE FUNCTION public.quote_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quote_requests_updated_at
  BEFORE UPDATE ON public.quote_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.quote_requests_updated_at();

CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON public.quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_email ON public.quote_requests(email);
CREATE INDEX IF NOT EXISTS idx_quote_requests_source ON public.quote_requests(source);

-- Storage bucket for claim photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-photos', 'claim-photos', true)
ON CONFLICT (id) DO NOTHING;
