-- Referral amounts: $75 -> $100 for both friend discount and referrer credit
ALTER TABLE public.client_referrals
  ALTER COLUMN referrer_credit   SET DEFAULT 100.00,
  ALTER COLUMN referred_discount SET DEFAULT 100.00;

UPDATE public.client_referrals
SET referrer_credit = 100.00, referred_discount = 100.00
WHERE referrer_credit = 75.00 OR referred_discount = 75.00;
