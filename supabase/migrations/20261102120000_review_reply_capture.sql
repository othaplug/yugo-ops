-- Capture an inbound SMS/email reply to a review request.
--
-- The straight-to-Google review cadence stops the moment the client acts. A
-- click already sets review_clicked; a reply to our text is the other signal.
-- We store the reply text + time so a coordinator can read what the client said
-- (the reply is our private feedback channel) and so a reply is distinguishable
-- from a link click in the record.
ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS review_replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_reply_text text;
