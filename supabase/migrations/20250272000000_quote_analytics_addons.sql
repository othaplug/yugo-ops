-- Add add-on analytics columns to quote_analytics.
-- Enables tracking: popular add-ons, addon attach rate, revenue uplift.

ALTER TABLE public.quote_analytics ADD COLUMN IF NOT EXISTS addon_revenue NUMERIC DEFAULT 0;
ALTER TABLE public.quote_analytics ADD COLUMN IF NOT EXISTS addon_count INTEGER DEFAULT 0;
ALTER TABLE public.quote_analytics ADD COLUMN IF NOT EXISTS addon_slugs TEXT[];
ALTER TABLE public.quote_analytics ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC;
ALTER TABLE public.quote_analytics ADD COLUMN IF NOT EXISTS tier_selected TEXT;
ALTER TABLE public.quote_analytics ADD COLUMN IF NOT EXISTS move_id UUID;
ALTER TABLE public.quote_analytics ADD COLUMN IF NOT EXISTS square_payment_id TEXT;
