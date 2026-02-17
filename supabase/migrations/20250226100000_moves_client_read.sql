-- Allow move clients to read their own moves (client_email matches logged-in user)
CREATE POLICY "Clients can read own moves"
  ON public.moves FOR SELECT TO authenticated
  USING (
    LOWER(client_email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
  );
