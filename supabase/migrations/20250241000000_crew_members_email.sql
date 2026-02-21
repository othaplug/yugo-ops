-- Optional email for crew portal members (for sending invite / first-time login instructions)
ALTER TABLE public.crew_members ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_crew_members_email ON public.crew_members (email) WHERE email IS NOT NULL;
