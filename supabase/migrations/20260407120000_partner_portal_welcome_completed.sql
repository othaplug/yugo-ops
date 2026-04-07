-- One-time partner portal intro: persist completion server-side (not localStorage-only).

ALTER TABLE public.partner_users
  ADD COLUMN IF NOT EXISTS portal_welcome_completed_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.partner_users.portal_welcome_completed_at IS 'Set when the partner completes the portal welcome tour; suppresses repeat intro.';

-- Partners who have already logged in should not see the intro after this ships.
UPDATE public.partner_users
SET portal_welcome_completed_at = COALESCE(last_login_at, first_login_at, now())
WHERE portal_welcome_completed_at IS NULL
  AND (
    COALESCE(login_count, 0) > 0
    OR first_login_at IS NOT NULL
  );
