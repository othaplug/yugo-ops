-- Deactivate cleaning addons — Yugo is not a cleaning company.
-- Setting active = false keeps existing quote references valid while hiding from new quotes.
UPDATE public.addons SET active = false, updated_at = NOW()
WHERE slug IN ('cleaning_origin', 'cleaning_destination');
