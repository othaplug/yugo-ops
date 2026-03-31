-- 5-minute first-response SLA target per lead (set at insert; used in coordinator UI).

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS response_sla_target_at TIMESTAMPTZ;

COMMENT ON COLUMN public.leads.response_sla_target_at IS 'Target time for first coordinator response (default: created_at + 5 minutes).';

CREATE OR REPLACE FUNCTION public.set_lead_response_sla_target()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.response_sla_target_at IS NULL THEN
    NEW.response_sla_target_at := COALESCE(NEW.created_at, NOW()) + INTERVAL '5 minutes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_set_response_sla_target ON public.leads;
CREATE TRIGGER leads_set_response_sla_target
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lead_response_sla_target();

UPDATE public.leads
SET response_sla_target_at = created_at + INTERVAL '5 minutes'
WHERE response_sla_target_at IS NULL;
