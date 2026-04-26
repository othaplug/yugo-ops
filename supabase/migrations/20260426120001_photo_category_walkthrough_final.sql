-- Crew final walkthrough / client sign-off photos (JobPhotos, signoff flow).
-- The app has always sent category walkthrough_final; the enum must include it.
ALTER TYPE photo_category ADD VALUE IF NOT EXISTS 'walkthrough_final';
