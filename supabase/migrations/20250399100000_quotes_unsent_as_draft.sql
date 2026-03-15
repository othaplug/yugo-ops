-- Ensure quotes that were created but never sent are stored as draft.
-- sent_at is only set when the quote is sent (api/quotes/send or quotes/update with sendToClient).
-- Any quote with sent_at IS NULL should be draft unless it's in a terminal state we don't touch.
UPDATE public.quotes
SET status = 'draft', updated_at = NOW()
WHERE sent_at IS NULL
  AND (status IS NULL OR status NOT IN ('accepted', 'declined', 'expired', 'superseded'));
