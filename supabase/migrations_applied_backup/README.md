# Migrations Applied Backup

Migrations in this folder were already applied to the remote database before being added to local migration history. They were moved here to resolve `db push` ordering conflicts.

- **20250412000000_prompt94_supplies_crating.sql** — Already applied on remote (columns exist). Marked via `supabase migration repair --status applied 20250412000000`. Kept here for reference; do not move back to `migrations/` or push will fail with duplicate key.
