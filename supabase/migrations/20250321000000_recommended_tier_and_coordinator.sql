-- Prompt 79: recommended_tier on quotes
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS
  recommended_tier TEXT DEFAULT 'premier'
  CHECK (recommended_tier IN ('essentials', 'premier', 'estate'));

-- Prompt 80: coordinator fields on moves for Estate confirmation emails
ALTER TABLE moves ADD COLUMN IF NOT EXISTS
  dedicated_coordinator UUID REFERENCES auth.users(id);
ALTER TABLE moves ADD COLUMN IF NOT EXISTS
  coordinator_phone TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS
  coordinator_email TEXT;
