-- Audit trail for SMS/email job notifications (optional logging from app)
CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  event TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT,
  job_id UUID,
  job_type TEXT CHECK (job_type IS NULL OR job_type IN ('move', 'delivery')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_log_job_idx ON public.notification_log (job_id, job_type);
CREATE INDEX IF NOT EXISTS notification_log_created_idx ON public.notification_log (created_at DESC);

COMMENT ON TABLE public.notification_log IS 'Optional audit log for transactional SMS/email to clients and partners';

-- Post-completion final price adjustments (super admin and senior admin roles in app)
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
