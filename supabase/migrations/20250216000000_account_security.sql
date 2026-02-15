-- 2FA and email verification for platform users
ALTER TABLE public.platform_users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;

-- Table for email change verification codes (expire in 15 min)
CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  new_email TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('email_change', '2fa')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_user_expires ON public.email_verification_codes (user_id, expires_at);

ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages verification codes"
  ON public.email_verification_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
