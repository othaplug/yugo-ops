-- Run this in Supabase Dashboard → SQL Editor → New query
-- Fixes: "Could not find the table 'public.platform_settings' in the schema cache"

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  crew_tracking BOOLEAN NOT NULL DEFAULT true,
  partner_portal BOOLEAN NOT NULL DEFAULT false,
  auto_invoicing BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (id, crew_tracking, partner_portal, auto_invoicing)
VALUES ('default', true, false, true)
ON CONFLICT (id) DO NOTHING;
