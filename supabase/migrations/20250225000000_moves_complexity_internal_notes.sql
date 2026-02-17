-- Add complexity_indicators and internal_notes for editable Office & Access cards
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS complexity_indicators JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.moves ADD COLUMN IF NOT EXISTS internal_notes TEXT;
