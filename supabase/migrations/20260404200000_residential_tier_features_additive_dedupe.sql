-- Align local_move tier_features with additive tier copy: no repeating Essential/Signature perks on higher tiers.
-- App mergeResidentialIncludeLinesDeduped also collapses duplicates when building quote payloads.

UPDATE public.tier_features
SET feature = 'Floor protection'
WHERE service_type = 'local_move'
  AND tier = 'signature'
  AND feature IN ('Floor & door frame protection', 'Floor & doorway protection');

DELETE FROM public.tier_features
WHERE service_type = 'local_move'
  AND tier = 'signature'
  AND feature IN (
    'Real-time GPS tracking',
    'Dedicated moving truck',
    'Dedicated Moving Truck',
    'Professional movers',
    'Basic disassembly & reassembly',
    'All equipment included'
  );

DELETE FROM public.tier_features
WHERE service_type = 'local_move'
  AND tier = 'estate'
  AND feature IN (
    'Real-time GPS tracking',
    'Dedicated moving truck',
    'Dedicated Moving Truck',
    'Professional movers',
    'Full furniture wrapping and protection throughout',
    'Floor and property protection throughout',
    'Precision placement in every room',
    'Wardrobe box included',
    'Wardrobe box for immediate use',
    'Debris and packaging removal',
    'Debris and packaging removal at completion',
    'Debris and packing removal at completion',
    'Mattress and TV protection included'
  );
