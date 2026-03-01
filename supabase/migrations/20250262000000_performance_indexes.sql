-- Performance indexes for frequently queried columns

CREATE INDEX IF NOT EXISTS idx_moves_move_code ON public.moves (move_code);
CREATE INDEX IF NOT EXISTS idx_moves_scheduled_date ON public.moves (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_moves_client_email ON public.moves (client_email);
CREATE INDEX IF NOT EXISTS idx_moves_status ON public.moves (status);

CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_number ON public.deliveries (delivery_number);
CREATE INDEX IF NOT EXISTS idx_deliveries_scheduled_date ON public.deliveries (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries (status);

CREATE INDEX IF NOT EXISTS idx_organizations_type ON public.organizations (type);
CREATE INDEX IF NOT EXISTS idx_organizations_name ON public.organizations (name);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices (due_date);

CREATE INDEX IF NOT EXISTS idx_tracking_sessions_is_active ON public.tracking_sessions (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tracking_sessions_job ON public.tracking_sessions (job_id, job_type);

CREATE INDEX IF NOT EXISTS idx_partner_users_user_id ON public.partner_users (user_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_org_id ON public.partner_users (org_id);

CREATE INDEX IF NOT EXISTS idx_crew_members_phone ON public.crew_members (phone);
