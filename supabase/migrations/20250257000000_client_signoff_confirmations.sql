-- Add confirmation checkboxes to client sign-offs for crew/company/client protection
ALTER TABLE public.client_sign_offs
  ADD COLUMN IF NOT EXISTS walkthrough_conducted_by_client BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_issues_during_move BOOLEAN,
  ADD COLUMN IF NOT EXISTS no_damages BOOLEAN,
  ADD COLUMN IF NOT EXISTS walkthrough_completed BOOLEAN,
  ADD COLUMN IF NOT EXISTS crew_conducted_professionally BOOLEAN;

COMMENT ON COLUMN public.client_sign_offs.walkthrough_conducted_by_client IS 'Client confirms walkthrough was conducted (items confirmation phase)';
COMMENT ON COLUMN public.client_sign_offs.no_issues_during_move IS 'Client confirms no issues during move (experience phase)';
COMMENT ON COLUMN public.client_sign_offs.no_damages IS 'Client confirms no damages to report (experience phase)';
COMMENT ON COLUMN public.client_sign_offs.walkthrough_completed IS 'Client confirms they completed walkthrough with crew (experience phase)';
COMMENT ON COLUMN public.client_sign_offs.crew_conducted_professionally IS 'Client confirms crew was professional (experience phase)';
