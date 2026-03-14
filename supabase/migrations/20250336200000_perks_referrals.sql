-- Perks & Client Referral System
-- NOTE: Uses client_referrals (not referrals) to avoid collision with existing realtor referrals table

-- ─── partner_perks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partner_perks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id          UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  offer_type          TEXT NOT NULL CHECK (offer_type IN (
                        'percentage_off','dollar_off','free_service',
                        'consultation','priority_access','custom'
                      )),
  discount_value      NUMERIC,
  redemption_code     TEXT,
  redemption_url      TEXT,
  valid_from          DATE DEFAULT CURRENT_DATE,
  valid_until         DATE,
  max_redemptions     INTEGER,
  current_redemptions INTEGER DEFAULT 0,
  is_active           BOOLEAN DEFAULT TRUE,
  display_order       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perks_active ON public.partner_perks(is_active);
CREATE INDEX IF NOT EXISTS idx_perks_partner ON public.partner_perks(partner_id);

-- ─── client_referrals ─────────────────────────────────────────────────────────
-- Separate from the realtor-focused 'referrals' table
CREATE TABLE IF NOT EXISTS public.client_referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_move_id  UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  referrer_name     TEXT NOT NULL,
  referrer_email    TEXT NOT NULL,
  referrer_phone    TEXT,
  referral_code     TEXT UNIQUE NOT NULL,
  referred_name     TEXT,
  referred_email    TEXT,
  referred_move_id  UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','used','expired','credited')),
  referrer_credit   NUMERIC DEFAULT 75.00,
  referred_discount NUMERIC DEFAULT 75.00,
  used_at           TIMESTAMPTZ,
  credited_at       TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_referrals_code   ON public.client_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_client_referrals_status ON public.client_referrals(status);
CREATE INDEX IF NOT EXISTS idx_client_referrals_email  ON public.client_referrals(referrer_email);

-- ─── perk_redemptions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.perk_redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perk_id      UUID NOT NULL REFERENCES public.partner_perks(id) ON DELETE CASCADE,
  client_email TEXT NOT NULL,
  move_id      UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  redeemed_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perk_redemptions_perk ON public.perk_redemptions(perk_id);

-- ─── Column additions ─────────────────────────────────────────────────────────
-- contacts: VIP tracking
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS vip_status      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS lifetime_value  NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_count  INTEGER DEFAULT 0;

-- quotes: link referral at quote stage
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES public.client_referrals(id) ON DELETE SET NULL;

-- moves: email send timestamps
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS perks_email_sent       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anniversary_email_sent TIMESTAMPTZ;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.partner_perks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_referrals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perk_redemptions  ENABLE ROW LEVEL SECURITY;

-- Platform users (admin) can manage all
DO $$ BEGIN
  CREATE POLICY "platform_users_manage_partner_perks"
    ON public.partner_perks FOR ALL
    USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "platform_users_manage_client_referrals"
    ON public.client_referrals FOR ALL
    USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "platform_users_manage_perk_redemptions"
    ON public.perk_redemptions FOR ALL
    USING (EXISTS (SELECT 1 FROM public.platform_users WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Public read on active perks (for tracking page / client facing)
DO $$ BEGIN
  CREATE POLICY "public_read_active_perks"
    ON public.partner_perks FOR SELECT
    USING (is_active = TRUE AND (valid_until IS NULL OR valid_until >= CURRENT_DATE));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Public read on own referral by code (for verify endpoint — filtered in app)
DO $$ BEGIN
  CREATE POLICY "public_read_referral_by_code"
    ON public.client_referrals FOR SELECT
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
