-- Align Estate tier bullet copy with Signature (packing wording; wardrobe benefit line).
UPDATE public.tier_features
SET feature = 'Wardrobe box for immediate use'
WHERE service_type = 'local_move'
  AND tier = 'estate'
  AND feature = 'Wardrobe box included';

UPDATE public.tier_features
SET feature = 'Debris and packing removal at completion'
WHERE service_type = 'local_move'
  AND tier = 'estate'
  AND feature IN ('Debris and packaging removal', 'Debris & packaging removal');
