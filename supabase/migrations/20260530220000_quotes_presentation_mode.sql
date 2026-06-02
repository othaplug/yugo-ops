-- Quote presentation mode — admin chooses how the client sees the quote.
--
-- comparison       (default) — all three tiers shown side by side.
-- estate_featured  — all three shown, Estate visually dominant, others
--                    in a collapsed "Compare with other packages" section.
-- estate_only      — single-tier Estate render, no comparison.
--
-- Selector is surfaced in the admin generate-quote form only when the
-- coordinator has chosen Estate as the recommended tier (and the
-- service is residential / long-distance). For every other case the
-- column stays at 'comparison'.
--
-- Client-side rendering for estate_featured / estate_only ships in a
-- follow-up. For now this column is captured and persisted so the
-- audit / analytics trail starts immediately.
--
-- CHECK constraint enforces the three known values. Idempotent.
-- NOTIFY pgrst makes PostgREST pick up the new column without a redeploy.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS presentation_mode TEXT
  NOT NULL DEFAULT 'comparison';

ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_presentation_mode_check;
ALTER TABLE quotes
  ADD CONSTRAINT quotes_presentation_mode_check
  CHECK (presentation_mode IN ('comparison', 'estate_featured', 'estate_only'));

COMMENT ON COLUMN quotes.presentation_mode IS
  'Client-facing render mode. comparison (default), estate_featured (Estate dominant + others collapsed), estate_only (single tier).';

NOTIFY pgrst, 'reload schema';
