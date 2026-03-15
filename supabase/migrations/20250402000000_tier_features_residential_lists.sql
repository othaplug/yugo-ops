-- Align tier checklist with "Your Move Includes" section (QuotePageClient).
-- Curated = essentials; Signature = + disassembly, debris removal; Estate = + coordinator, concierge, perks.
-- Placeholders: "Dedicated moving truck" → truckLabel, "Professional movers" → "Professional crew of [N]".

DELETE FROM public.tier_features
  WHERE service_type = 'local_move'
    AND tier IN ('curated', 'signature', 'estate', 'essentials', 'premier');

-- Essential (curated) — matches INCLUSIONS_ESSENTIALS + dynamic truck/crew
INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('local_move', 'curated', 'Dedicated moving truck', 1),
  ('local_move', 'curated', 'Professional movers', 2),
  ('local_move', 'curated', 'Premium moving blankets', 3),
  ('local_move', 'curated', 'Floor & doorway protection', 4),
  ('local_move', 'curated', 'All equipment included', 5),
  ('local_move', 'curated', 'Real-time GPS tracking', 6),
  ('local_move', 'curated', 'Guaranteed flat price', 7),
  ('local_move', 'curated', 'Zero-damage commitment', 8);

-- Signature — curated + INCLUSIONS_PREMIER
INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('local_move', 'signature', 'Dedicated moving truck', 1),
  ('local_move', 'signature', 'Professional movers', 2),
  ('local_move', 'signature', 'Premium moving blankets', 3),
  ('local_move', 'signature', 'Floor & doorway protection', 4),
  ('local_move', 'signature', 'All equipment included', 5),
  ('local_move', 'signature', 'Real-time GPS tracking', 6),
  ('local_move', 'signature', 'Guaranteed flat price', 7),
  ('local_move', 'signature', 'Zero-damage commitment', 8),
  ('local_move', 'signature', 'Basic disassembly & reassembly', 9),
  ('local_move', 'signature', 'Debris & packaging removal', 10);

-- Estate — signature + INCLUSIONS_ESTATE (incl. 30 day concierge, partner perks)
INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('local_move', 'estate', 'Dedicated moving truck', 1),
  ('local_move', 'estate', 'Professional movers', 2),
  ('local_move', 'estate', 'Premium moving blankets', 3),
  ('local_move', 'estate', 'Floor & doorway protection', 4),
  ('local_move', 'estate', 'All equipment included', 5),
  ('local_move', 'estate', 'Real-time GPS tracking', 6),
  ('local_move', 'estate', 'Guaranteed flat price', 7),
  ('local_move', 'estate', 'Zero-damage commitment', 8),
  ('local_move', 'estate', 'Basic disassembly & reassembly', 9),
  ('local_move', 'estate', 'Debris & packaging removal', 10),
  ('local_move', 'estate', 'Pre-move inventory walkthrough', 11),
  ('local_move', 'estate', 'Premium gloves handling', 12),
  ('local_move', 'estate', 'Dedicated move coordinator', 13),
  ('local_move', 'estate', '30 day concierge support', 14),
  ('local_move', 'estate', 'Exclusive partner offers & perks', 15);
