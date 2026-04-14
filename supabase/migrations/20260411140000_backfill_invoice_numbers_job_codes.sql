-- Align stored invoice_number with Square job numbers (DLV-xxxx / M-...) for rows linked to a job.

UPDATE public.invoices inv
SET invoice_number =
  'DLV-' || (regexp_match(trim(COALESCE(d.delivery_number, '')), '(\d{4})$'))[1]
FROM public.deliveries d
WHERE inv.delivery_id = d.id
  AND (regexp_match(trim(COALESCE(d.delivery_number, '')), '(\d{4})$')) IS NOT NULL;

UPDATE public.invoices inv
SET invoice_number =
  'M-' || left(
    regexp_replace(
      COALESCE(nullif(trim(m.move_code), ''), 'MOVE'),
      '[^A-Za-z0-9-]',
      '',
      'g'
    ),
    24
  )
FROM public.moves m
WHERE inv.move_id = m.id;
