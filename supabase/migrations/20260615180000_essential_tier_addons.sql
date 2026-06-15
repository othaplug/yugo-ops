-- Essential-tier add-ons: make the services that are NOT included in Essential
-- purchasable by the client (and selectable by the coordinator) when Essential
-- is the selected tier. They are excluded from Signature/Estate, where they are
-- already included. Mirrors src/lib/tiers/essential-addons.ts and the live seed.
--
-- Idempotent: inserts only when the slug is absent; restricts existing overlaps.

INSERT INTO public.addons
  (slug, name, description, price, price_type, unit_label, tiers, percent_value,
   applicable_service_types, excluded_tiers, is_popular, active,
   show_on_quote_page, show_on_admin_form, display_order)
SELECT v.slug, v.name, v.description, v.price, v.price_type, v.unit_label,
       NULL, NULL, ARRAY['local_move']::text[],
       ARRAY['signature','estate']::text[], false, true, true, true, v.display_order
FROM (VALUES
  ('full_wrap_upgrade',  'Full wrap upgrade',            'Every piece of furniture wrapped. No item left unprotected.',   75, 'flat',     NULL,        40),
  ('room_of_choice',     'Room-of-choice placement',     'Crew places every item exactly where you want it.',            75, 'flat',     NULL,        41),
  ('debris_removal',     'Debris and packaging removal',  'All packing materials removed and disposed of after your move.',45, 'flat',     NULL,        42),
  ('tv_protection_bag',  'TV protection bag',            'Padded protection for flat-screen televisions.',               15, 'per_unit', 'per TV',    43),
  ('extra_wrap',         'Additional wrapped items',     'Each additional piece wrapped in quilted blankets.',           15, 'per_unit', 'per item',  44),
  ('assembly_bundle',    'Assembly bundle',              'Disassembly and reassembly for up to 3 items.',               199, 'flat',     NULL,        45)
) AS v(slug, name, description, price, price_type, unit_label, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.addons a WHERE a.slug = v.slug);

-- These already existed but showed on every tier; they are included in
-- Signature/Estate, so restrict them to Essential like the rest.
UPDATE public.addons
SET excluded_tiers = ARRAY['signature','estate']::text[]
WHERE slug IN ('mattress_bag', 'wardrobe_boxes', 'extra_assembly');
