-- Allow admins to log reviews that clients left directly on Google or other
-- platforms without using the emailed link.
--
-- source:   'system' (default, sent via our email flow)
--           'manual' (admin-entered, came from Google/other channel)
-- platform: 'google' | 'internal' | 'other'
--           only set for manual entries; system reviews leave it NULL

ALTER TABLE review_requests
  ADD COLUMN IF NOT EXISTS source   TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS platform TEXT;

ALTER TABLE review_requests
  DROP CONSTRAINT IF EXISTS review_requests_source_check,
  ADD CONSTRAINT review_requests_source_check
    CHECK (source IN ('system', 'manual'));

ALTER TABLE review_requests
  DROP CONSTRAINT IF EXISTS review_requests_platform_check,
  ADD CONSTRAINT review_requests_platform_check
    CHECK (platform IN ('google', 'internal', 'other'));
