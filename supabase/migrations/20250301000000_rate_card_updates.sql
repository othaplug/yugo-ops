-- 1. Fix Zone 2 & 3 surcharges to match rate card document
-- Zone 2: Standard +$145, Partner +$120
-- Zone 3: Standard +$245, Partner +$210

UPDATE public.rate_card_zones SET surcharge = 120
WHERE zone_number = 2 AND pricing_tier = 'partner';

UPDATE public.rate_card_zones SET surcharge = 145
WHERE zone_number = 2 AND pricing_tier = 'standard';

UPDATE public.rate_card_zones SET surcharge = 210
WHERE zone_number = 3 AND pricing_tier = 'partner';

UPDATE public.rate_card_zones SET surcharge = 245
WHERE zone_number = 3 AND pricing_tier = 'standard';

-- 2. Distance overage (per-km beyond 40 km / 80 km)
CREATE TABLE IF NOT EXISTS public.rate_card_distance_overages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES public.partner_rate_cards(id) ON DELETE CASCADE,
  pricing_tier TEXT NOT NULL DEFAULT 'partner',
  from_km NUMERIC NOT NULL,
  to_km NUMERIC,
  rate_per_km NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed for all existing rate cards
INSERT INTO public.rate_card_distance_overages (rate_card_id, pricing_tier, from_km, to_km, rate_per_km)
SELECT id, 'partner', 40, 80, 2.35 FROM public.partner_rate_cards;

INSERT INTO public.rate_card_distance_overages (rate_card_id, pricing_tier, from_km, to_km, rate_per_km)
SELECT id, 'partner', 80, NULL, 2.95 FROM public.partner_rate_cards;

INSERT INTO public.rate_card_distance_overages (rate_card_id, pricing_tier, from_km, to_km, rate_per_km)
SELECT id, 'standard', 40, 80, 2.75 FROM public.partner_rate_cards;

INSERT INTO public.rate_card_distance_overages (rate_card_id, pricing_tier, from_km, to_km, rate_per_km)
SELECT id, 'standard', 80, NULL, 3.50 FROM public.partner_rate_cards;

-- 3. Weight/heavy item surcharges
CREATE TABLE IF NOT EXISTS public.rate_card_weight_surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES public.partner_rate_cards(id) ON DELETE CASCADE,
  pricing_tier TEXT NOT NULL DEFAULT 'partner',
  weight_min_lbs NUMERIC NOT NULL,
  weight_max_lbs NUMERIC,
  surcharge_per_item NUMERIC NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: 250-400 lbs, 400-600 lbs (600+ = custom, no default surcharge)
INSERT INTO public.rate_card_weight_surcharges (rate_card_id, pricing_tier, weight_min_lbs, weight_max_lbs, surcharge_per_item, label)
SELECT id, 'partner', 250, 400, 75, '250-400 lbs' FROM public.partner_rate_cards;

INSERT INTO public.rate_card_weight_surcharges (rate_card_id, pricing_tier, weight_min_lbs, weight_max_lbs, surcharge_per_item, label)
SELECT id, 'partner', 400, 600, 165, '400-600 lbs' FROM public.partner_rate_cards;

INSERT INTO public.rate_card_weight_surcharges (rate_card_id, pricing_tier, weight_min_lbs, weight_max_lbs, surcharge_per_item, label)
SELECT id, 'standard', 250, 400, 95, '250-400 lbs' FROM public.partner_rate_cards;

INSERT INTO public.rate_card_weight_surcharges (rate_card_id, pricing_tier, weight_min_lbs, weight_max_lbs, surcharge_per_item, label)
SELECT id, 'standard', 400, 600, 195, '400-600 lbs' FROM public.partner_rate_cards;

ALTER TABLE public.rate_card_distance_overages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_card_weight_surcharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "distance_overages_admin" ON public.rate_card_distance_overages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "weight_surcharges_admin" ON public.rate_card_weight_surcharges FOR ALL USING (true) WITH CHECK (true);
