-- ══════════════════════════════════════════════════
-- Email Templates + Business Config + Login History
-- ══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_slug TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  merge_variables TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

INSERT INTO public.email_templates (template_slug, subject, body_html, merge_variables) VALUES
('quote_email', 'Your Moving Quote from {{company_name}}', '<p>Hi {{client_name}},</p><p>Thank you for requesting a quote. View your personalized quote here: {{quote_link}}</p>', ARRAY['client_name', 'company_name', 'quote_link', 'total_price']),
('booking_confirmation', 'Booking Confirmed — {{move_date}}', '<p>Hi {{client_name}},</p><p>Your move on {{move_date}} is confirmed!</p>', ARRAY['client_name', 'move_date', 'move_address', 'total_price', 'crew_names']),
('follow_up_reminder', 'Your quote is waiting — {{company_name}}', '<p>Hi {{client_name}},</p><p>We noticed you haven''t booked yet. Your quote is still available: {{quote_link}}</p>', ARRAY['client_name', 'company_name', 'quote_link']),
('move_day_details', 'Move Day Details — {{move_date}}', '<p>Hi {{client_name}},</p><p>Your move is tomorrow! Here are the details...</p>', ARRAY['client_name', 'move_date', 'move_address', 'crew_names', 'company_phone']),
('completion_review', 'Move Complete! How did we do?', '<p>Hi {{client_name}},</p><p>Your move is complete. We hope everything went smoothly!</p>', ARRAY['client_name', 'crew_names', 'company_name']),
('invoice', 'Invoice from {{company_name}} — {{move_date}}', '<p>Hi {{client_name}},</p><p>Here is your invoice for the move on {{move_date}}.</p>', ARRAY['client_name', 'company_name', 'move_date', 'total_price'])
ON CONFLICT (template_slug) DO NOTHING;

-- Business config entries
INSERT INTO public.platform_config (key, value, description) VALUES
('company_name', 'YUGO', 'Company display name'),
('company_legal_name', 'OHELLO Inc.', 'Legal name for contracts/invoices'),
('company_phone', '(647) 370-4525', 'Main company phone'),
('company_email', 'info@helloyugo.com', 'Main company email'),
('company_address', '', 'Company street address'),
('company_hst_number', '', 'HST/tax registration number'),
('business_hours', 'Mon-Sat 7:00 AM - 8:00 PM', 'Operating hours'),
('after_hours_contact', '', 'After-hours contact info'),
('quote_expiry_days', '7', 'Days until quote expires'),
('default_deposit_pct', '25', 'Default deposit percentage'),
('minimum_deposit', '100', 'Minimum deposit amount in dollars'),
('quote_id_prefix', 'YGO-', 'Prefix for quote IDs'),
('auto_followup_enabled', 'true', 'Auto-send follow-up if no response'),
('followup_max_attempts', '3', 'Max follow-up attempts'),
('tipping_enabled', 'false', 'Allow clients to tip after move'),
('quote_engagement_tracking', 'true', 'Track client behaviour on quote page'),
('instant_quote_widget', 'false', 'Enable public quote calculator'),
('valuation_upgrades', 'true', 'Show protection upgrades on quotes')
ON CONFLICT (key) DO NOTHING;

-- Login history for security
CREATE TABLE IF NOT EXISTS public.login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device TEXT,
  ip_address TEXT,
  location TEXT,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user ON public.login_history(user_id, created_at DESC);
