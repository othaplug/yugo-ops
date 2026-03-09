-- Phone on crews table (fallback if device lookup fails)
ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS phone TEXT;

-- Phone on registered_devices — the tablet SIM number customers call directly
ALTER TABLE public.registered_devices ADD COLUMN IF NOT EXISTS phone TEXT;

-- Seed new platform_config keys for company info (no-op if they already exist)
INSERT INTO public.platform_config (key, value, description) VALUES
  ('company_website', '', 'Company website URL'),
  ('dispatch_phone', '', 'Dispatch phone number shown on crew portal and tracking pages'),
  ('notifications_from_email', 'notifications@opsplus.co', 'Email address used as the From address for outbound emails'),
  ('admin_notification_email', '', 'Email that receives admin alerts (tips, payment failures, etc.)'),
  ('company_social_instagram', '', 'Instagram profile URL'),
  ('company_social_facebook', '', 'Facebook page URL'),
  ('company_social_twitter', '', 'X (Twitter) profile URL'),
  ('company_social_linkedin', '', 'LinkedIn company page URL'),
  ('company_review_url', '', 'Google review URL shown on post-move screens')
ON CONFLICT (key) DO NOTHING;
