-- Remove duplicate estate line (white glove + premium art) from tier_features; app defaults updated to match.
DELETE FROM public.tier_features
WHERE service_type = 'local_move'
  AND tier = 'estate'
  AND feature = 'Premium handling for art, antiques, and specialty items';
