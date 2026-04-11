-- Idempotent repair: ensures post-completion price audit table exists and PostgREST picks it up.
-- Safe if 20260410140000_notification_log_job_final_price_edits.sql already ran.

CREATE TABLE IF NOT EXISTS public.job_final_price_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('move', 'delivery')),
  edited_by UUID NOT NULL,
  edited_by_name TEXT NOT NULL,
  original_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  difference NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  invoice_may_need_reissue BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_final_price_edits_job_idx ON public.job_final_price_edits (job_id, job_type);

COMMENT ON TABLE public.job_final_price_edits IS 'Audit trail when owner/admin/manager adjusts final price after job completion';

NOTIFY pgrst, 'reload schema';
