-- Server-durable autosave for in-progress quote drafts.
--
-- The admin quote wizard already autosaves a full snapshot to the operator's
-- browser (localStorage, via useFormDraft). This table mirrors that snapshot
-- server-side so a draft survives a cleared cache and can be resumed on any
-- device. `id` is the SAME uuid the client uses for its localStorage draft, so
-- the ?draftId= resume link resolves against either store.
--
-- Access is exclusively through the service-role admin client behind
-- requireStaff() (see /api/admin/quote-drafts). RLS is enabled with no policies
-- so nothing is reachable with the anon key.

create table if not exists public.quote_drafts (
  id uuid primary key,
  operator_email text not null,
  form_type text not null default 'quote',
  title text,
  path text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_drafts_operator_updated_idx
  on public.quote_drafts (operator_email, updated_at desc);

alter table public.quote_drafts enable row level security;
