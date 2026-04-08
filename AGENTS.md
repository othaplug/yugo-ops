# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

Yugo Ops is a **single Next.js 16 application** (not a monorepo). The main app lives at the workspace root; an independent HubSpot extension project under `OPS Generate Quote/` is excluded from `tsconfig.json` and can be ignored for normal development.

All data, auth, and realtime come from a **remote Supabase project** (no local Docker or local Supabase). You must have valid `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` for full functionality.

### Running the dev server

```bash
npm run dev          # starts Next.js on http://127.0.0.1:3000
```

The root `/` redirects to `/login` (Supabase auth). Public pages that render without authentication include `/login`, `/quote-widget`, `/widget/quote`, and various `/track/*`, `/quote/*`, `/review/*` routes.

### Type checking

```bash
npx tsc --noEmit     # full TypeScript check (~40s)
```

There is **no ESLint config** in the repo (no `.eslintrc*` or `eslint.config.*`), so `npx eslint` is not expected to run. Type checking with `tsc` is the primary static analysis tool.

### Building

```bash
npm run build        # production build (~90s)
```

### Environment variables

Copy `.env.example` to `.env.local`. See `README.md` for the full list. The three Supabase keys are required for almost every page to function; most other services degrade gracefully when their keys are placeholder values.

### Gotchas

- The `package-lock.json` lockfile is present; use **`npm install`** (not pnpm/yarn).
- No automated test suite (no Jest, Vitest, Playwright, etc.) exists in the repo. Validation is via `tsc --noEmit` and `npm run build`.
- Next.js 16 requires Node >= 18. The VM ships with Node 22 via nvm which is compatible.
- The `square` package is listed in `serverExternalPackages` in `next.config.ts` because it uses Node-only APIs; do not attempt to import it in client components.
