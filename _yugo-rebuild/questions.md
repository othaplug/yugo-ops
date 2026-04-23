# Yugo+ Admin Rebuild — Open Questions

Per the execution prompt: "If a reference image is ambiguous, ask in the form of a committed question file … and continue with the most faithful interpretation."

Each question lists the default interpretation taken (so work can proceed) and the information needed to confirm or override. Revisit at each phase gate.

## Q1. Purple admin replacing the live wine/gold theme — is this cutover immediate?

**Context:** `src/app/globals.css` today defines a dark wine (`--yu-bg-page: #2b0416`) and gold (`--gold: #c9a962`) admin palette that is live in production. PRD §0 mandates neutral + purple `#5E56F0` with no wine/rose in admin. §2.1 gives the full light palette.

**Default:** New tokens file (`src/styles/tokens.css`) and Phase 1 primitives use the PRD palette. Existing wine variables remain untouched in `globals.css` so legacy components keep rendering until migrated in Phases 4-7. Admin default is light; dark is toggleable.

**Needs confirmation:**
- Are any live admin screens expected to keep the wine palette until a full cutover date?
- Does "estate tier indicated through status tags only" (PRD §0) mean the purple Brand chip variant doubles as the Estate tier chip, or do you want a distinct rose-accent chip just for Estate tier labels on B2C records?

## Q2. Phosphor → Lucide: full migration or Phase 4+ scope only?

**Context:** `@phosphor-icons/react` is used across ~60+ files (sidebar, top bar, data table, admin module pages). PRD §1.2 rule 11 and Phase 1.6 mandate Lucide only.

**Default:** Install `lucide-react`. All **new** components (`src/components/primitives/`, `composites/`, `layout/`, `modules/`) use Lucide. Existing Phosphor imports in legacy files stay until that file is touched in a module rebuild. Add an ESLint rule in Phase 7 polish that bans Phosphor imports outside a short legacy allowlist.

**Needs confirmation:**
- Acceptable, or do you want a dedicated pre-Phase-1 migration commit that rips Phosphor out wholesale?

## Q3. Tailwind v4 vs. `tailwind.config.ts` snippet in the prompt

**Context:** Repo uses Tailwind v4 with `@import "tailwindcss"` and `@tailwindcss/postcss`. There is no `tailwind.config.ts`, and v4's recommended API is `@theme` blocks in CSS. The prompt (§1.3) gives a v3-style config snippet.

**Default:** Implement the tokens using `@theme` inside `src/styles/tokens.css`. Expose the same semantic utilities (`bg-surface`, `text-primary`, `bg-accent`, etc.) so call-site code matches the PRD intent. Skip creating `tailwind.config.ts` entirely.

**Needs confirmation:**
- Or downgrade to Tailwind v3 and create `tailwind.config.ts`? (I would not recommend this; TW v4 is materially better with the `@theme` API and the repo is already on it.)

## Q4. Where do module routes live vs. existing ones?

**Context:** PRD/prompt specifies:
- `/admin/customers` → repo uses `/admin/clients`
- `/admin/b2b` → repo uses per-vertical `/admin/partners/{designers,hospitality,realtors,retail,gallery}`
- `/admin/pm` → does not exist
- `/admin/analytics` → repo has `/admin/reports`, `/admin/revenue`, `/admin/finance/*`
- `/admin/pricing` → repo has `/admin/platform` and `/admin/sales/pricing-map`
- `/admin/fleet` → does not exist

**Default:**
- Build new canonical routes at the PRD paths (`/admin/customers`, `/admin/b2b`, `/admin/pm`, `/admin/analytics`, `/admin/pricing`, `/admin/fleet`).
- Leave legacy routes in place.
- Sidebar points to PRD routes. Stub redirects on legacy routes will be added in Phase 7 polish after the user confirms no external bookmarks / email links reference them.
- B2B verticals (designers, hospitality, realtors, retail, gallery, and the others in the project summary) become saved views on `/admin/b2b` rather than top-level routes.

**Needs confirmation:**
- Is the dual-route arrangement acceptable during migration, or should new routes replace the old ones atomically?
- For B2B, the PRD says "11 verticals per project summary" — project summary is not in this repo. Please confirm the vertical list (designers, hospitality, realtors, retail, gallery + 6 more).

## Q5. Property Management data model

**Context:** PRD §6.2 describes a PM module with Profile/Buildings/Schedule/Projects/Analytics/Statements tabs. Repo has `building_profiles` but no clear PM-company table. PM companies today appear to be rows in `partners` with a type discriminator (not confirmed).

**Default:** Treat PM as a filter over `partners` (e.g., `partners.vertical = 'pm'`) with associations to `building_profiles` via an existing join. Build the UI module assuming that shape.

**Needs confirmation:**
- Correct? Or is there a dedicated `pm_companies` / `property_managers` table to use?

## Q6. Package manager — `npm` or `pnpm`?

**Context:** Prompt §1.1 uses `pnpm`. Repo has `package-lock.json` and scripts use `npm run`. No `pnpm-lock.yaml`.

**Default:** Use `npm install` for dependencies. Commit the resulting `package-lock.json` delta.

**Needs confirmation:**
- Keep `npm`, or switch to `pnpm` for the rebuild (which would change CI and Vercel install behavior)?

## Q7. Storybook and Vitest and Playwright

**Context:** PRD §10.8 / prompt §TESTING require Vitest, Playwright, and optional Storybook. None of the three are installed.

**Default:** Install Vitest + Playwright during Phase 1 alongside the dependency block, configure minimal harnesses, but limit new test coverage in Phases 1-3 to the atoms and DataTable. Skip Storybook (prompt allows skipping if not present). The `{component}.stories.tsx` clause in Phase 1.6 becomes `{component}.test.tsx`.

**Needs confirmation:**
- Install Storybook too? Or is skipping acceptable?

## Q8. Existing `src/app/admin/layout.tsx` preserves auth gates — new `(shell)/layout.tsx` strategy?

**Context:** Existing admin layout is a Next 16 async server component that handles login redirect, `platform_users` role read, 2FA gate, password-change gate, then wraps children with the existing `AdminShell`. Prompt §2.3 says "Wraps every admin page with AdminShell. Providers: ThemeProvider, QueryClient, Toaster (sonner)" and implies a clean shell file.

**Default:** Keep existing `src/app/admin/layout.tsx` intact for the auth gates. Inside, swap the *visual* shell to the new `AdminShell` from `src/components/layout/AdminShell.tsx` only once it reaches parity (notifications, command palette, realtime listener, session timeout, sidebar config). Providers (ThemeProvider, QueryClient, Toaster) get added in a new top-level providers component that both old and new shells can consume, avoiding duplication.

**Needs confirmation:**
- Is the parity bar acceptable, or should we ship the new shell first even if realtime/notifications temporarily regress?

## Q9. Supabase types generation

**Context:** Working-with-data §1 says to run `supabase gen types typescript --local > types/supabase.ts` if missing. The CLI requires either a running local Supabase stack or `--project-id`. No `types/supabase.ts` exists in the repo today. Existing code works around this by using `unknown` / `as` casts with `createClient()` from `@supabase/ssr`.

**Default:** Generate types against the linked remote (`supabase gen types typescript --linked > src/types/supabase.ts`) during Phase 1. Check the file in. Add an `npm run db:types` script. If the generation fails without credentials, commit a hand-authored minimal `Database` interface covering the tables the Phase 4 modules touch, and expand as later modules land.

**Needs confirmation:**
- Is running against the linked remote acceptable? Alternative: run against local CLI before each commit.

## Q10. Branch name and PR strategy

**Context:** Prompt says push to `feat/admin-rebuild`; this worktree is on `claude/cool-noether-708d9a`. Recent commits are all named `"update"` which does not match Conventional Commits (Quality Rule 10).

**Default:** Do not force-rename the worktree branch. On Phase 0 commit, use `chore: rebuild audit baseline` per the prompt. When ready to push, create `feat/admin-rebuild` as a branch from the current HEAD and push it. Each phase gate gets its own PR title like `Phase 1: foundation` with a body linking to the gate acceptance checks.

**Needs confirmation:**
- Should the worktree branch itself be renamed to `feat/admin-rebuild`, or should the PR target a fresh branch created at phase boundaries?
- Is it okay that prior commits are named `"update"`, or do you want a squash at Phase 0 to clean history before rebuild commits land?

## Q11. "Pipeline value" metric on the dashboard

**Context:** PRD §6.1 Row 1 lists Revenue MTD, Active moves, New leads, Pipeline value. "Pipeline value" is not defined elsewhere.

**Default:** Sum of `quotes.amount` where status is in a non-terminal set (`Sent`, `Viewed`, `Closing`), plus the `size` on `leads` whose `status` is `Qualified` or `Closing` and no quote yet. Formatted as money.

**Needs confirmation:**
- Exact definition?

## Q12. "On-time %" and "At-risk" for Moves metric strip

**Context:** PRD §4.4 requires these. No existing field in `moves` labelled on-time; there are start/end/actual timestamps.

**Default:** "On-time %" = (moves with `actual_arrival_at <= scheduled_arrival_at + 15m`) / (completed moves in window). "At-risk" = scheduled in next 72h with any of: unassigned crew, no truck, unresolved change request.

**Needs confirmation:**
- Confirm thresholds and window. Should at-risk include margin-below-threshold moves?

## Q13. Estate tier form fields referenced by PRD §7.5

**Context:** "Estate triggers Estate-specific form fields" is mentioned but the field list is not given in the PRD.

**Default:** Assume existing Estate flow in `src/app/estate/*` and its supporting `scripts/seed-*` capture the field list. Surface the same fields in the MoveWizard drawer when Estate is selected; defer specifics to the Phase 4.4 Moves implementation.

**Needs confirmation:**
- Please list Estate-specific fields (appraisal, insurance tier, VIP contact, white-glove packing flags, etc.).

---

These questions do not block Phase 0. They are blockers for Phase 1 (Q1, Q2, Q3, Q6, Q9) and Phase 4+ (Q4, Q5, Q11, Q12, Q13). Q7, Q8, Q10 can be resolved at the relevant phase gate.
