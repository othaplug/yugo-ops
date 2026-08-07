-- Backfill PM move coordinator names.
--
-- Every PM batch move up to now stored the operator's email local-part
-- as coordinator_name ("othaplug" instead of "Jon", "oche" instead of
-- "Oche (Yugo)", etc.) because the pm-batch route derived the value
-- from auth.user_metadata.full_name which is stale, falling back to
-- user.email.split("@")[0]. The code fix (previous change in this
-- commit) now reads from platform_users.name (Settings → Personal &
-- profile writes there). This migration repairs the rows already in
-- the DB.
--
-- Match on local-part: any moves row where coordinator_name equals
-- split_part(platform_users.email, '@', 1) was created by that
-- operator. Update to platform_users.name when present and non-empty.
-- Rows where the local-part matches no operator, or where the operator
-- has no Full Name set, are left unchanged.

UPDATE public.moves m
SET coordinator_name = pu.name
FROM public.platform_users pu
WHERE m.coordinator_name IS NOT NULL
  AND m.coordinator_name = split_part(pu.email, '@', 1)
  AND pu.name IS NOT NULL
  AND btrim(pu.name) <> '';
