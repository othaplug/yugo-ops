-- Secure storage add-on: full-service storage-in-transit billed PER WEEK, with
-- the weekly rate scaling by move size (resolved in app code, see
-- src/lib/quotes/storage-pricing.ts). The DB price is a placeholder (1BR rate);
-- the size-based rate is injected wherever the add-on is priced.
--
-- Mechanic: price_type = per_unit, quantity = number of weeks (client picks),
-- capped 1–12 in the UI and clamped server-side in calculateAddons.
-- Idempotent: insert only when the slug is absent.

INSERT INTO public.addons
  (slug, name, description, price, price_type, unit_label, tiers, percent_value,
   applicable_service_types, excluded_tiers, is_popular, active,
   show_on_quote_page, show_on_admin_form, display_order)
SELECT
  'secure_storage',
  'Secure storage',
  'Full-service storage between move legs: our crew loads it into our climate-controlled, insured facility and redelivers when you''re ready. Billed per week.',
  65, 'per_unit', 'per week', NULL, NULL,
  ARRAY['local_move','long_distance','single_item','white_glove','office_move']::text[],
  NULL, true, true, true, true, 50
WHERE NOT EXISTS (SELECT 1 FROM public.addons a WHERE a.slug = 'secure_storage');

-- Single-item moves use a flat $35/week rate (no bedroom size); the rest scale
-- by move size. Rate logic lives in src/lib/quotes/storage-pricing.ts.
UPDATE public.addons
SET applicable_service_types =
  ARRAY['local_move','long_distance','single_item','white_glove','office_move']::text[]
WHERE slug = 'secure_storage';
