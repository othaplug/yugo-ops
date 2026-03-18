-- Add placement features to Signature and Estate tiers.
-- Signature: "Room of choice placement"
-- Estate: "White glove item handling & precision placement" (replaces "Premium gloves handling")

-- Signature: insert placement feature
INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('local_move', 'signature', 'Room of choice placement', 11)
ON CONFLICT (service_type, tier, feature) DO NOTHING;

-- Estate: remove the old vague label, insert the precise one
DELETE FROM public.tier_features
  WHERE service_type = 'local_move'
    AND tier = 'estate'
    AND feature = 'Premium gloves handling';

INSERT INTO public.tier_features (service_type, tier, feature, display_order) VALUES
  ('local_move', 'estate', 'White glove item handling & precision placement', 11)
ON CONFLICT (service_type, tier, feature) DO NOTHING;
