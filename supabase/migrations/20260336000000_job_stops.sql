-- Multi-stop addresses for moves, quotes, and deliveries.
-- The primary from_address / to_address / pickup_address / delivery_address columns
-- remain as the canonical first stop. Additional stops live here.

create table if not exists job_stops (
  id            uuid primary key default gen_random_uuid(),
  job_type      text not null check (job_type in ('move', 'quote', 'delivery')),
  job_id        uuid not null,
  stop_type     text not null check (stop_type in ('pickup', 'dropoff')),
  address       text not null,
  lat           numeric(10, 7),
  lng           numeric(10, 7),
  sort_order    int  not null default 1,   -- 0 = primary (reserved for existing cols), 1+ = additional
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for fast lookup by job
create index if not exists job_stops_job_idx on job_stops (job_type, job_id, sort_order);

-- RLS: enable + admin-only write, public-readable when job is publicly trackable (delegated to app layer)
alter table job_stops enable row level security;

create policy "Service role full access to job_stops"
  on job_stops for all
  to service_role
  using (true)
  with check (true);

-- Auto-update updated_at
create or replace function set_job_stops_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger job_stops_updated_at
  before update on job_stops
  for each row execute function set_job_stops_updated_at();
