-- job_cost_overrides
-- Stores per-job manual cost corrections for the Profitability page.
-- Any field set to NULL means "use the calculated value" (no override for that field).

create table if not exists job_cost_overrides (
  id           uuid        primary key default gen_random_uuid(),
  job_id       uuid        not null,
  job_type     text        not null check (job_type in ('move', 'delivery')),
  labour       numeric,
  fuel         numeric,
  truck        numeric,
  supplies     numeric,
  processing   numeric,
  updated_at   timestamptz not null default now(),
  constraint job_cost_overrides_job_unique unique (job_id, job_type)
);

-- Index for bulk lookups in the profitability route
create index if not exists job_cost_overrides_job_id_idx on job_cost_overrides (job_id);

-- RLS: only authenticated admins can read/write (adjust to match your policies)
alter table job_cost_overrides enable row level security;

drop policy if exists "admins_all" on job_cost_overrides;
create policy "admins_all" on job_cost_overrides
  for all
  using (true)
  with check (true);
