-- Create the `move-assets` storage bucket.
--
-- Two endpoints have referenced this bucket from day one but no migration
-- ever created it, so every client upload to the post-payment photo survey
-- (and the legacy room-photos endpoint) failed silently with "Bucket not
-- found". The API returned a generic "Upload failed" to the client.
--
--   - /api/survey/[token]/route.ts      (post-payment "Help us prepare" flow)
--   - /api/track/moves/[id]/room-photos (older room-photos JSON flow)
--
-- The bucket is public so the URLs we persist on move_survey_photos.photo_url
-- (via getPublicUrl) remain valid without re-signing on every admin render.
-- Object paths are namespaced under survey/{move_uuid}/...  Guessing a valid
-- URL requires knowing the move UUID — same security model as the survey
-- token link itself.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'move-assets',
  'move-assets',
  true,
  12582912, -- 12 MB, matches the API's per-file size check
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public SELECT — bucket is public, so reads work without auth.
DROP POLICY IF EXISTS "Public read move-assets" ON storage.objects;
CREATE POLICY "Public read move-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'move-assets');

-- Writes are server-only. The survey API uses the service role via
-- createAdminClient(), which bypasses RLS. We deliberately do NOT add a
-- public INSERT policy — that would let anyone write into the bucket
-- with just the anon key.
