-- Card bullet copy: "packing" -> "packaging" (Signature + Estate).
UPDATE public.tier_features
SET feature = 'Debris and packaging removal at completion'
WHERE service_type = 'local_move'
  AND tier IN ('signature', 'estate')
  AND feature = 'Debris and packing removal at completion';
