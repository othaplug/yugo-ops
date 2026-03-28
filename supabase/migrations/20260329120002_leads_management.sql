-- Lead management: capture, assignment, response tracking, quote linkage.

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_number TEXT NOT NULL UNIQUE,

  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,

  source TEXT NOT NULL CHECK (source IN (
    'website_form', 'phone_call', 'email', 'google_ads',
    'referral', 'partner_referral', 'realtor', 'walk_in',
    'social_media', 'repeat_client', 'other'
  )),
  source_detail TEXT,
  referral_source_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,

  service_type TEXT,
  move_size TEXT,
  from_address TEXT,
  to_address TEXT,
  preferred_date DATE,
  message TEXT,

  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,

  first_response_at TIMESTAMPTZ,
  response_time_seconds INTEGER,
  response_method TEXT CHECK (response_method IS NULL OR response_method IN (
    'quote_sent', 'phone_call', 'email', 'sms'
  )),

  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
    'new', 'assigned', 'contacted', 'qualified', 'quote_sent',
    'follow_up', 'converted', 'lost', 'disqualified', 'stale'
  )),
  lost_reason TEXT,

  quote_uuid UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  move_id UUID REFERENCES public.moves(id) ON DELETE SET NULL,
  hubspot_contact_id TEXT,
  hubspot_deal_id TEXT,

  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  estimated_value NUMERIC,

  stale_escalation_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status_created ON public.leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.leads (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_first_response ON public.leads (first_response_at) WHERE first_response_at IS NULL;

CREATE TABLE IF NOT EXISTS public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'created', 'assigned', 'viewed', 'contacted',
    'quote_sent', 'follow_up_scheduled', 'follow_up_completed',
    'status_changed', 'note_added', 'converted', 'lost'
  )),
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead ON public.lead_activities (lead_id, created_at DESC);

DO $$ BEGIN
  CREATE TRIGGER set_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "staff_select_leads" ON public.leads
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.platform_users pu
        WHERE pu.user_id = auth.uid()
        AND pu.role IN ('owner','admin','manager','coordinator','dispatcher','viewer','sales'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff_modify_leads" ON public.leads
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users pu
        WHERE pu.user_id = auth.uid()
        AND pu.role IN ('owner','admin','manager','coordinator','dispatcher','sales'))
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.platform_users pu
        WHERE pu.user_id = auth.uid()
        AND pu.role IN ('owner','admin','manager','coordinator','dispatcher','sales'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff_select_lead_activities" ON public.lead_activities
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.platform_users pu
        WHERE pu.user_id = auth.uid()
        AND pu.role IN ('owner','admin','manager','coordinator','dispatcher','viewer','sales'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "staff_modify_lead_activities" ON public.lead_activities
    FOR ALL USING (
      EXISTS (SELECT 1 FROM public.platform_users pu
        WHERE pu.user_id = auth.uid()
        AND pu.role IN ('owner','admin','manager','coordinator','dispatcher','sales'))
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM public.platform_users pu
        WHERE pu.user_id = auth.uid()
        AND pu.role IN ('owner','admin','manager','coordinator','dispatcher','sales'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
END $$;
