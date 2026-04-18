-- Flags for multi-stop / project quotes (denormalized for reporting)

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS is_project BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS origin_count INTEGER;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS destination_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_quotes_is_project ON public.quotes (is_project) WHERE is_project = TRUE;
