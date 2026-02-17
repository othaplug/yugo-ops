-- Ensure from_access and to_access exist on moves (access dropdowns per address)
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS from_access TEXT;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS to_access TEXT;
