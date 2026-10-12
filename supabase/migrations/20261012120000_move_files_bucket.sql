-- Create the `move-files` storage bucket.
--
-- The admin "Upload File" button on the move page (MoveFilesSection.tsx) POSTs
-- to /api/admin/move-files which uploads to this bucket, but no migration ever
-- created it. Every operator upload failed with Supabase's "Bucket not found"
-- error (surfaced as a toast on the admin move page).
--
-- Same shape as move-assets: public bucket so getPublicUrl() returns a stable
-- URL we can persist on move_files.file_url without re-signing on every
-- admin/client render. Writes are server-only — the API uses the service role
-- via createAdminClient() which bypasses RLS, and we do NOT add a public
-- INSERT policy.
--
-- No mime allowlist: operators upload heterogeneous docs (PDFs, Word, Excel,
-- images, floor plans, loading-dock briefs). The route is gated by
-- requireStaff() so untrusted uploads cannot reach the bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'move-files',
  'move-files',
  true,
  52428800, -- 50 MB
  NULL
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public SELECT: bucket is public, so reads work without auth. URLs are
-- unguessable (contain the move UUID + a timestamp), same model as move-assets.
DROP POLICY IF EXISTS "Public read move-files" ON storage.objects;
CREATE POLICY "Public read move-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'move-files');
