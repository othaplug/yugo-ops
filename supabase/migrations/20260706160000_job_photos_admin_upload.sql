-- ───────────────────────────────────────────────────────────────────
-- Admin photo upload — job_photos schema fixes (2026-07-06)
--
-- Operator: "why do i keep getting upload failed when i try to
-- upload photos to b2b jobs".
--
-- The admin photo upload endpoint (POST /api/admin/deliveries/[id]/
-- crew-photos, shipped in commit 21bc6d63) has been failing on every
-- attempt because job_photos was designed for crew captures only:
--
--   1. category is a photo_category enum whose values are:
--      pre_move_condition | loading | in_transit | delivery_placement
--      post_move_condition | damage_documentation | other
--      The endpoint tries to insert 'admin_upload' — not in the
--      enum, insert dies with "invalid input value for enum
--      photo_category".
--
--   2. taken_by is NOT NULL and REFERENCES crew_members(id). Admins
--      aren't in crew_members, so no valid UUID exists for them. The
--      endpoint omits the column, triggering the NOT NULL constraint.
--
-- Both fire on every upload — that's why the toast has never shown
-- anything but "Upload failed" since the feature shipped 2026-06-30.
--
-- Fixes:
--   1. ALTER TYPE photo_category ADD VALUE 'admin_upload'  (idempotent
--      via IF NOT EXISTS).
--   2. ALTER COLUMN taken_by DROP NOT NULL. Admin-uploaded rows will
--      have taken_by = NULL. The GET path (crew-photos/route.ts) reads
--      category + checkpoint to group photos and never touches
--      taken_by, so no downstream reader breaks. Adding an
--      admin_user_id column later would be nicer for audit, but nulling
--      taken_by unblocks the feature immediately.
--
-- NB: ALTER TYPE ADD VALUE cannot run inside an implicit transaction
-- on some Postgres versions. Supabase migrations run in an implicit
-- transaction wrapper — but ADD VALUE with IF NOT EXISTS works fine
-- since PG 12. Confirmed against Supabase's PG 15/16 build.
-- ───────────────────────────────────────────────────────────────────

ALTER TYPE public.photo_category ADD VALUE IF NOT EXISTS 'admin_upload';

ALTER TABLE public.job_photos
  ALTER COLUMN taken_by DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
