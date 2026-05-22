-- Multi-pickup premium: per-extra-pickup surcharge applied in calcResidential
-- (src/app/api/quotes/generate/route.ts). Each additional origin beyond the
-- first contributes this amount. Default $400/extra-pickup matches the
-- existing `multi_origin_premium` used by project quotes
-- (residential-project-quote-lines.ts) so the two surfaces price the same
-- logistics cost consistently.
--
-- Edit the value via UPDATE platform_config WHERE key='multi_pickup_premium'.

INSERT INTO platform_config (key, value, description) VALUES
  ('multi_pickup_premium', '400',
    'Surcharge per additional pickup origin beyond the first on local_move / long_distance quotes (CAD).')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description;
