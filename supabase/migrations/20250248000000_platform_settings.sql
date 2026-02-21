-- Platform-wide app toggles (single row). Enforced by API and server logic.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  crew_tracking BOOLEAN NOT NULL DEFAULT true,
  partner_portal BOOLEAN NOT NULL DEFAULT false,
  auto_invoicing BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure single row
INSERT INTO public.platform_settings (id, crew_tracking, partner_portal, auto_invoicing)
VALUES ('default', true, false, true)
ON CONFLICT (id) DO NOTHING;

-- Only service role / backend should read/write; no RLS for this table (admin API uses createAdminClient).
