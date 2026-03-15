-- Client experience rating (1-5 stars) and optional feedback on move completion view
ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS client_rating INTEGER CHECK (client_rating >= 1 AND client_rating <= 5),
  ADD COLUMN IF NOT EXISTS client_feedback TEXT;

COMMENT ON COLUMN public.review_requests.client_rating IS 'In-app star rating from client (1-5) on move completion view';
COMMENT ON COLUMN public.review_requests.client_feedback IS 'Optional feedback text when client rates 1-3 stars';
