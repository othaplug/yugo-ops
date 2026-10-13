-- Server-side record of a client accepting the tracking-portal agreement
-- (Terms of Use / Privacy / Cookies) shown by TrackingAgreementModal.
--
-- Until now acceptance lived ONLY in a browser cookie, so there was no
-- accepted_at, no identity, no terms version, and no audit trail — the business
-- could not prove a given client accepted, and the gate re-prompted on every
-- new device or cookie clear. This table makes acceptance durable and
-- device-independent: once the client for a given move/delivery/shipment has
-- accepted the current terms version, the portal stops prompting on any device.
--
-- Writes are server-only: /api/track/agreement uses the service role via
-- createAdminClient() (bypasses RLS) after verifying the entity's track token.
-- No public policies are added, so RLS denies all anon/auth access by default.

CREATE TABLE IF NOT EXISTS public.tracking_agreement_acceptances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- "move" | "delivery" | "inbound_shipment" (matches verifyTrackToken types)
  entity_type   text NOT NULL,
  entity_id     uuid NOT NULL,
  -- Which version of the terms was accepted; bump the app constant to re-prompt
  terms_version text NOT NULL,
  accepted_at   timestamptz NOT NULL DEFAULT now(),
  -- Audit context captured from the accepting request
  ip            text,
  user_agent    text,
  -- Identity snapshot at the time of acceptance (so the record stands alone
  -- even if the underlying row is later edited)
  client_name   text,
  client_email  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Fast "has this entity accepted the current version?" lookup.
CREATE INDEX IF NOT EXISTS tracking_agreement_entity_version_idx
  ON public.tracking_agreement_acceptances (entity_type, entity_id, terms_version);

ALTER TABLE public.tracking_agreement_acceptances ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
