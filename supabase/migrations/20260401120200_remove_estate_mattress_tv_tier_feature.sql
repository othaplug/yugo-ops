-- Version 20260401120200: unique slot after 20260401120100 (20260401120000 is notifications_from_opsplus_co).
-- Remove mattress/TV line from Estate tier "Your Move Includes" list (local_move).
DELETE FROM public.tier_features
WHERE service_type = 'local_move'
  AND tier = 'estate'
  AND feature = 'Mattress and TV protection included';
