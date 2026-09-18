-- payment_rules_by_type: align with FULL_PAYMENT_AT_BOOKING_SERVICES.
--
-- The set in code (src/app/quote/[quoteId]/quote-shared.ts:459) is the
-- structural source of truth: white_glove, specialty, single_item,
-- bin_rental, b2b_delivery, b2b_oneoff are all full-payment-at-booking.
-- The DB platform_config JSON drifted — it had white_glove and specialty
-- as `percentage 25%` and bin_rental missing entirely. Every admin
-- surface reading this config via getQuotePaymentPipelineMode() then
-- offered a deposit-then-balance split for services the server would
-- reject at payment time (YG-30428 / Lydell Rector class of bug).
--
-- This migration realigns the JSON so admin + server + client agree.
--
-- Idempotent: overwrites the whole JSON with the corrected shape.

UPDATE public.platform_config
SET value = '{
  "residential": {"deposit_type":"percentage","essential":0.10,"essential_min":150,"signature":0.10,"signature_min":250,"estate":0.25,"estate_min":500},
  "long_distance": {"deposit_type":"percentage","rate":0.30,"min":250},
  "office": {"deposit_type":"percentage","rate":0.30,"min":500},
  "office_move": {"deposit_type":"percentage","rate":0.30,"min":500},
  "labour_only": {"deposit_type":"percentage","rate":0.30,"min":200},
  "event": {"deposit_type":"percentage","rate":0.25,"min":300},
  "single_item": {"deposit_type":"full_payment"},
  "white_glove": {"deposit_type":"full_payment"},
  "specialty": {"deposit_type":"full_payment"},
  "bin_rental": {"deposit_type":"full_payment"},
  "b2b_oneoff": {"deposit_type":"full_payment"},
  "b2b_delivery": {"deposit_type":"full_payment"}
}'::jsonb
WHERE key = 'payment_rules_by_type';

INSERT INTO public.platform_config (key, value)
SELECT 'payment_rules_by_type', '{
  "residential": {"deposit_type":"percentage","essential":0.10,"essential_min":150,"signature":0.10,"signature_min":250,"estate":0.25,"estate_min":500},
  "long_distance": {"deposit_type":"percentage","rate":0.30,"min":250},
  "office": {"deposit_type":"percentage","rate":0.30,"min":500},
  "office_move": {"deposit_type":"percentage","rate":0.30,"min":500},
  "labour_only": {"deposit_type":"percentage","rate":0.30,"min":200},
  "event": {"deposit_type":"percentage","rate":0.25,"min":300},
  "single_item": {"deposit_type":"full_payment"},
  "white_glove": {"deposit_type":"full_payment"},
  "specialty": {"deposit_type":"full_payment"},
  "bin_rental": {"deposit_type":"full_payment"},
  "b2b_oneoff": {"deposit_type":"full_payment"},
  "b2b_delivery": {"deposit_type":"full_payment"}
}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_config WHERE key = 'payment_rules_by_type'
);

NOTIFY pgrst, 'reload schema';
