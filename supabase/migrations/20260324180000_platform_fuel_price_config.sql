-- Fuel $/L for crew navigation, dispatch route estimates, and move fuel logging (CAD).
INSERT INTO public.platform_config (key, value, description) VALUES
  ('fuel_price_gas_cad_per_litre', '1.65', 'Gasoline price per litre (CAD) for navigation fuel estimates'),
  ('fuel_price_diesel_cad_per_litre', '1.85', 'Diesel price per litre (CAD) for navigation fuel estimates'),
  ('navigation_fuel_type', 'gas', 'Active fuel: gas or diesel — selects which litre price applies fleet-wide for nav and logged move fuel')
ON CONFLICT (key) DO NOTHING;
