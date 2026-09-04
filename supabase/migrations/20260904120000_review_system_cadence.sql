-- Unified post-move review cadence.
--
-- One orchestration row per completed move (review_requests) drives three
-- touches: SMS at ~3h, then two emails (~day 3 and ~day 6). The public star
-- tap is the gate: 4-5 goes to Google, 1-3 opens the private feedback form and
-- alerts an admin. Applies to ALL completed moves regardless of the post-move
-- checklist; only an open damage claim or a permanent opt-out excludes a client.

-- Touch 3: the final email, a few days after the reminder.
ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS final_send_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_sent_at timestamptz;

-- Permanent opt-out, honoured across every future job. Keyed by normalized
-- email and/or phone so a client without a contacts row is still suppressed
-- (an email unsubscribe or an SMS STOP reply writes a row here).
CREATE TABLE IF NOT EXISTS public.review_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS review_opt_outs_email_idx
  ON public.review_opt_outs (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS review_opt_outs_phone_idx
  ON public.review_opt_outs (phone) WHERE phone IS NOT NULL;
