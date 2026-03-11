-- Optional phone for platform users (SMS notifications)
ALTER TABLE public.platform_users ADD COLUMN IF NOT EXISTS phone TEXT;
