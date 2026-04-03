-- Max numeric suffix for quote_id values matching prefix (e.g. YG-3009 -> 3009).
-- Used so new quote ids stay above both DB quotes and HubSpot job_no values.

CREATE OR REPLACE FUNCTION public.max_quote_numeric_suffix(quote_prefix text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    MAX(
      CASE
        WHEN q.quote_id LIKE quote_prefix || '%'
         AND char_length(q.quote_id) > char_length(quote_prefix)
         AND substring(q.quote_id from char_length(quote_prefix) + 1) ~ '^[0-9]+$'
        THEN substring(q.quote_id from char_length(quote_prefix) + 1)::integer
        ELSE NULL
      END
    ),
    0
  )
  FROM public.quotes q;
$$;

REVOKE ALL ON FUNCTION public.max_quote_numeric_suffix(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.max_quote_numeric_suffix(text) TO service_role;
