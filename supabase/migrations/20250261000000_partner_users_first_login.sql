ALTER TABLE public.partner_users
  ADD COLUMN IF NOT EXISTS first_login_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS password_changed boolean DEFAULT false;
