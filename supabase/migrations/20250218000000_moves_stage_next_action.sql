-- Add stage, next_action, updated_at, client_phone, preferred_contact to moves for editable detail cards and contact modal
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS stage TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS preferred_contact TEXT;
