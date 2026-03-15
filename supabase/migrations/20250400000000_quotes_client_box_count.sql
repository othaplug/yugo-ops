-- Prompt 90 box fix: persist client box count on quotes so price/labour use it and edit form can show it
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS client_box_count INTEGER;
