-- Realtors table for Add Realtor flow and agent dropdown in referrals
CREATE TABLE IF NOT EXISTS public.realtors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  email TEXT,
  brokerage TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add new columns to referrals for updated Create Referral form
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.realtors(id);
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS preferred_contact TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS move_type TEXT;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS move_id UUID; -- links to moves.id when a move exists for this client
