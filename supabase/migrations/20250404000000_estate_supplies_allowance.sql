-- Estate tier: packing supplies allowance (base $250, scaled by move size and complexity in app)
INSERT INTO public.platform_config (key, value, description)
VALUES ('estate_supplies_allowance', '250', 'Estate tier: base packing supplies allowance in dollars; scaled by move size and inventory complexity.')
ON CONFLICT (key) DO UPDATE SET value = '250', description = EXCLUDED.description;
