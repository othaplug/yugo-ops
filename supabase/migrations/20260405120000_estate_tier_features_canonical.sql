-- Replace local_move Estate tier_features with the canonical additive list (matches app DEFAULT_ESTATE_ADDITIONS).
-- Removes legacy duplicates: GPS, debris, premium-art line overlapping white glove, old valuation wording, etc.

DELETE FROM public.tier_features
WHERE service_type = 'local_move'
  AND tier = 'estate';

INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('local_move', 'estate', 'Dedicated move coordinator from booking to final placement', 1),
  ('local_move', 'estate', 'Pre-move walkthrough with room-by-room plan', 2),
  ('local_move', 'estate', 'Full furniture wrapping and protection throughout', 3),
  ('local_move', 'estate', 'Complex disassembly & reassembly', 4),
  ('local_move', 'estate', 'Floor and property protection throughout', 5),
  ('local_move', 'estate', 'All packing materials and supplies included', 6),
  ('local_move', 'estate', 'White glove handling for furniture, art, and high-value items', 7),
  ('local_move', 'estate', 'Precision placement in every room', 8),
  ('local_move', 'estate', 'Full repair or replacement valuation coverage', 9),
  ('local_move', 'estate', 'Pre-move inventory planning and oversight', 10),
  ('local_move', 'estate', '30-day post-move concierge support', 11),
  ('local_move', 'estate', 'Exclusive partner offers & perks', 12);
