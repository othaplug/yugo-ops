-- Allow a partner user to be linked to multiple organizations (e.g. Steven + "Steven and Avenue Road").
-- Drop one-user-one-org constraint; keep one-org-one-user and add unique (user_id, org_id).
ALTER TABLE public.partner_users
  DROP CONSTRAINT IF EXISTS partner_users_user_id_key;

ALTER TABLE public.partner_users
  ADD CONSTRAINT partner_users_user_id_org_id_key UNIQUE (user_id, org_id);
