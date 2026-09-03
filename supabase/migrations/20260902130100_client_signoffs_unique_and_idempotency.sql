-- Two guardrails on client_sign_offs so the signoff pipeline is
-- deterministic and idempotent.
--
-- 1. UNIQUE (job_id, job_type) prevents concurrent double-submit from
--    inserting two rows. Prior state: the composite index (see
--    20250243000000_crew_portal_extended.sql:107) was non-unique, so
--    `.maybeSingle()` on the GET could error and return null, which the
--    crew UI interpreted as "not signed" and re-prompted.
--
-- 2. idempotency_key on POST retries: the crew UI mints one UUID per
--    signoff-screen mount and sends it as x-idempotency-key. Server
--    checks by key first — if a row already exists for that key, return
--    it instead of re-inserting. Cures the "flaky 4G, tap Submit twice"
--    class of duplicate.
--
-- Dedupe first: keep the earliest signed_at for each (job_id, job_type)
-- pair, delete the rest so the UNIQUE constraint can be applied.

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY job_id, job_type
    ORDER BY signed_at ASC NULLS LAST, created_at ASC, id ASC
  ) AS rn
  FROM public.client_sign_offs
)
DELETE FROM public.client_sign_offs
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS client_sign_offs_job_unique
  ON public.client_sign_offs (job_id, job_type);

ALTER TABLE public.client_sign_offs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS client_sign_offs_idempotency_key_unique
  ON public.client_sign_offs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';
