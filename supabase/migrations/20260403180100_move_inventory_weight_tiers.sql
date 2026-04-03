-- Optional per-line weight tier and actual weight for move inventory (B2C coordination).
ALTER TABLE public.move_inventory
  ADD COLUMN IF NOT EXISTS weight_tier_code TEXT,
  ADD COLUMN IF NOT EXISTS actual_weight_lbs INTEGER;

COMMENT ON COLUMN public.move_inventory.weight_tier_code IS 'Canonical weight tier code (light, standard, heavy, very_heavy, super_heavy, extreme)';
COMMENT ON COLUMN public.move_inventory.actual_weight_lbs IS 'Coordinator-entered weight when tier requires actual pounds';
