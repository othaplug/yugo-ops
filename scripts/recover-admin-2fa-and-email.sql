-- ═══════════════════════════════════════════════════════════════════════════
-- Locked out of admin because 2FA email fails? You do NOT need to open the app.
--
-- Option A (no DB edit): In Vercel/hosting, set NOTIFICATIONS_FROM_EMAIL=notifications@opsplus.co
--     and redeploy — the API ignores broken platform_config for the From address.
--
-- Option B: Run this in Supabase → SQL Editor (project owner).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Fix Resend "from" domain (stops "helloyugo.com is not verified" if opsplus.co is verified in Resend)
UPDATE public.platform_config
SET value = 'notifications@opsplus.co'
WHERE key = 'notifications_from_email';

-- Optional: align other keys if a prior migration pointed them at helloyugo
UPDATE public.platform_config SET value = 'opsplus.co' WHERE key = 'public_domain' AND value = 'helloyugo.com';
UPDATE public.platform_config SET value = 'https://app.opsplus.co' WHERE key = 'company_website' AND value = 'https://helloyugo.com';

-- 2) LAST RESORT — skip 2FA until email works (replace with your login email)
-- Uncomment and run only if you still cannot receive codes after step 1 + redeploy:
/*
UPDATE public.platform_users pu
SET two_factor_enabled = false
FROM auth.users u
WHERE pu.user_id = u.id
  AND lower(u.email) = lower('you@yourdomain.com');
*/

-- Verify
SELECT key, value FROM public.platform_config WHERE key IN (
  'notifications_from_email',
  'public_domain',
  'company_website'
);
