-- Short link for the review SMS. The full /review?token=<jwt> URL is far too
-- long and reads as spam in a text. Each review_requests row gets a short code
-- resolved by /r/<code>, so the SMS carries e.g. https://www.yugoplus.co/r/k7m2p9q.

ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS short_code text;

CREATE UNIQUE INDEX IF NOT EXISTS review_requests_short_code_idx
  ON public.review_requests (short_code) WHERE short_code IS NOT NULL;
