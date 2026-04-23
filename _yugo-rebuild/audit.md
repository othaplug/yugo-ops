# Yugo+ Admin Rebuild — Phase 0 Audit

Read-only. No code changed.

## 1. Environment snapshot

| Thing | PRD assumes | Repo reality |
|---|---|---|
| Root path prefix | `/app`, `/components`, `/lib`, `/types`, `/styles` | `src/app`, `src/components`, `src/lib` (no `/src/types`, no `/src/styles`) |
| Tailwind | v3 (`theme.extend` in `tailwind.config.ts`) | v4 (`@import "tailwindcss"` in `globals.css`, no `tailwind.config.ts` theme block) |
| Icons | Lucide React | Phosphor (`@phosphor-icons/react@2.1.10`) — already wired via `PhosphorProvider.tsx` |
| Next | n/a | Next 16.1.6, React 19.2.3, React Compiler enabled |
| Package manager | `pnpm` | `npm` (see `package-lock.json`, no `pnpm-lock.yaml`) |
| Server state | TanStack Query | Not installed |
| Client state | Zustand | Not installed |
| Radix | all listed packages | None installed |
| Forms | react-hook-form + zod | zod only; forms currently hand-rolled |
| date-fns | required | Not installed |
| cmdk | required | Not installed (existing `CommandPalette.tsx` is hand-rolled) |
| cva / clsx / tailwind-merge | required | Not installed |
| Theme | Light default, dark toggle, neutral + purple `#5E56F0` | Dark default, gold `#c9a962` (+ wine tokens for B2B/brand strips) |
| Supabase types | `/types/supabase.ts` (codegen) | Does not exist |
| Branch | `feat/admin-rebuild` | Working on `main` (per `always-main-yugo-ops.mdc` user rule) |

## 2. Current admin routes (`src/app/admin`)

74 `page.tsx` files, 332 total `.ts`/`.tsx` files in `src/app/admin`. Top-level route segments:

```
activity         drafts             leads              platform
audit-log        finance            move-projects      projects
bin-rentals      inbound-shipments  moves              quotes
buildings        inbox              notifications      reports
calendar         invoices           partners           revenue
change-requests  (root page.tsx)    perks              sales
claims           (layout.tsx)       settings           tips
clients                              widget-leads      users
crew                                 components/       dispatch
deliveries                          -- (ignore)        -- (ignore)
```

None of these line up 1:1 with the PRD module list. The PRD calls for: Dashboard, Inbox, My Work, Calendar, Leads, Quotes, Moves, Invoices, Customers, B2B Partners, Property Management, Buildings, Crew, Fleet, Dispatch, Analytics, Pricing Engine, Reports, Platform Settings. See §5 (conflicts) below.

## 3. Existing admin components (key inventory)

In `src/app/admin/components/` — 30 files, shell-level:

- `AdminShell.tsx` — 1037 lines. Current left sidebar + chrome + mobile nav. Replaces PRD §4.1/§4.4.
- `Sidebar.tsx` — 146 lines. Static sidebar.
- `CommandPalette.tsx` — 315 lines. Hand-rolled (no `cmdk`). Replaces PRD §7.2.
- `NotificationDropdown.tsx`, `NotificationContext.tsx`, `RealtimeListener.tsx` — existing notification system. Would be replaced by PRD §7.3 drawer.
- `Badge.tsx`, `FilterBar.tsx`, `SearchBox.tsx`, `CreateButton.tsx`, `SegmentedProgressBar.tsx`, `StatPctChange.tsx` — small primitives/composites already shipped.
- `ProfileDropdown.tsx`, `SessionTimeout.tsx`, `TwoFAGate.tsx`, `ChangePasswordGate.tsx` — auth chrome that PRD never mentions. Must be preserved.
- `LiveActivityFeed.tsx`, `LiveOperationsCard.tsx`, `ScheduleItem.tsx` — dashboard content currently in use.
- `PostCompletionPriceEdit.tsx`, `IncidentsSection.tsx`, `ContactDetailsModal.tsx` — domain-specific widgets.

In `src/components/admin/`:

- `DataTable.tsx` — **1332 lines**. Already the sole table engine in admin. Directly conflicts with PRD §5 DataTable rebuild.
- `SchedulingSuggestion.tsx`, `RevenueForecastWidget.tsx`, `PartnerPortalFeaturesCard.tsx`, `CancelMoveModal.tsx`, `SectionError.tsx`, `AdminContextHints.tsx`, `InternalConfigKeyHint.tsx`, `ReferralPartnersOverviewHint.tsx` — current module surfaces.
- `b2b/` — B2B-specific views.

In `src/components/ui/` — shared primitives across admin+client: `KpiCard.tsx`, `Modal.tsx`, `ConfirmDialog.tsx`, `InfoHint.tsx`, `MultiStopAddressField.tsx`, `AddressAutocomplete.tsx`, `SectionDivider.tsx`, `PhosphorProvider.tsx`, `OfflineBanner.tsx`, `DraftBanner.tsx`, `ModalDialogFrame.tsx`. Used by client pages too — can't wipe.

## 4. Supabase table → PRD module mapping

No `/types/supabase.ts` codegen file exists. Tables below are observed from `.from("…")` calls in `src/lib` plus migration filenames.

| PRD module | Tables that map | Notes |
|---|---|---|
| Leads | `leads` (confirmed via migrations + `src/lib/leads/*`), `widget_leads`, `client_referrals` | Leads table exists. |
| Quotes | `quotes`, `quote_events`, `quote_analytics`, `quote_engagement`, `quote_addons`/`addons` | Rich schema already. |
| Moves | `moves`, `move_inventory`, `move_change_requests`, `move_photos`, `move_documents`, `extra_items`, `incidents`, `status_events`, `tracking_sessions` | |
| Customers (B2C) | `contacts` | No dedicated `customers` table; `contacts` plays that role. |
| Customers (B2B / PM) | `organizations` (+ `partners` views) | PRD's "B2B Partners" and "Property Management" are both `organizations` rows segmented by type. |
| Crew | `crews` (members stored as JSON/array), `crew_tracking_*`, `crew_sessions` | No normalized per-member table surfaced. |
| Invoices | `invoices` | Square linked via `square_invoice_id`. |
| Buildings | `building_profiles` | |
| Deliveries / Bin rentals | `deliveries`, `bin_orders` | **PRD does not mention these — they are active modules.** |
| Platform / Settings | `platform_users`, `platform_config`, `notification_preferences`, `in_app_notifications`, `login_history`, `webhook_logs` | |
| Dispatch | Derived from `moves` + `tracking_sessions` | No dedicated table; fine. |
| Analytics | Aggregates over all of the above | |

## 5. Gaps (PRD says yes, repo says no)

1. **No dedicated `customers` table.** PRD Customers module has to sit on `contacts` (B2C) + `organizations` (B2B/PM). This works but every customer query is a union.
2. **No normalized crew-member table.** Crew rows store `members` as JSON. PRD crew columns (per-member status, rating, damage rate) will need either (a) a new `crew_members` table, or (b) computed views over `crews.members`. Raise this before Phase 5.1.
3. **No `deals`/`pipeline_stage` table.** PRD funnel metrics (New → Contacted → Quoted → Closing → Won) assume a single status field on `leads`. We'll need to confirm the current `leads.status` enum covers all five stages.
4. **No Analytics tables.** PRD "MRR" chart assumes subscription-style data. Yugo+ is transactional (per-move revenue). MRR is the wrong chart shape here — repurpose as "Revenue trend" or "Monthly revenue". Confirmed with repo: there is no subscription or ARR surface.
5. **No `notifications` table per PRD §7.3.** Repo uses `in_app_notifications`. Same idea, different name — reuse.
6. **No `audit_log` table per PRD §7.1.** Repo has `webhook_logs` + `login_history` + status events. A unified `audit_log` doesn't exist yet. Decision needed before Settings/Audit log page.

## 6. Conflicts (PRD and repo disagree on direction)

These need your call before Phase 1 starts. Each is a ship-blocker.

### C1. Icons: Phosphor vs Lucide — **RESOLVED by user**
PRD §10.1 mandates Lucide. User override: keep Phosphor. Every PRD/execution-guide mention of Lucide icons gets translated to Phosphor equivalents. Icon primitive will wrap `@phosphor-icons/react`, not `lucide-react`. `lucide-react` will not be installed.

### C2. Colors: gold+wine (current) vs neutral+purple (PRD) — **RESOLVED**
User confirmed no wine, no gold in admin. README line 72 agrees: "No Yugo brand colors in admin. Wine/Rose are Estate-only." PRD §2.1 purple `#5E56F0` accent stands. Existing `--yu-*`, `--gold`, `--gold2`, `--yugo-accent` tokens in `globals.css` stay for client/estate surfaces and are **not** used in rebuilt admin. Admin gets a new token layer (`--ygo-admin-*` or similar) that cohabits `globals.css`.

### C3. Tailwind v4, not v3. — **Needs decision**
PRD Prompt 1.3 says to edit `tailwind.config.ts` with `theme.extend`. Repo uses Tailwind v4, which is configured in CSS via `@theme`. I'll implement tokens through `@theme` in a new `styles/admin-tokens.css` (imported inside `globals.css`) and skip the config file rewrite. This matches your stack; no behavior change from the PRD's intent.

### C4. `/styles/tokens.css` vs existing `src/app/globals.css` — **Needs decision**
`globals.css` is 3638 lines. It carries tokens for the client-facing premium quote system (wine, gold, Instrument Serif hero fonts), estate, crew, tracking, etc. Your user rule says "do not alter our premium design system on add or upgrade." I will **not** edit existing variables or move them. Admin tokens will live in a **new** `src/styles/admin-tokens.css` scoped under `.ygo-admin-scope` (or `[data-admin]`) on the admin shell root, so existing surfaces are untouched. Agreed?

### C5. Existing `DataTable.tsx` (1332 lines) vs new PRD DataTable. — **Needs decision**
Current admin uses this single table everywhere. Two paths:
- **(a) Parallel build**: new table at `src/components/admin-v2/data-table/` behind a feature flag; migrate each module by swapping the import as we rebuild that module's page.
- **(b) Rip and replace**: delete the old table day one, every module that imports it breaks until its page is rebuilt.
I recommend **(a)** — keeps the app shippable. Each module PR flips its own imports when its new page lands.

### C6. Existing `AdminShell.tsx` (1037 lines) vs new PRD shell. — **Needs decision**
Same choice. Recommend parallel: new shell mounts at `src/app/admin/(shell-v2)/layout.tsx` using a route group, we migrate pages into it page by page. When every module is migrated, the old shell is deleted and `(shell-v2)` is renamed. The current `admin/layout.tsx` auth wrapping (TwoFAGate, ChangePasswordGate) stays — that is auth, not chrome.

### C7. Module route names differ from PRD.
Current uses `/admin/clients` for what the PRD calls `Customers`. Current has `/admin/partners` nested under hospitality/gallery/health/designers — PRD collapses into `/admin/b2b`. Current has `/admin/deliveries`, `/admin/bin-rentals`, `/admin/inbound-shipments` — PRD never mentions any of these. Options:
- **(a) Rename to match PRD** and leave 301 redirects from old paths (changes every internal link).
- **(b) Keep current URLs** and only update the Sidebar labels/config to match PRD semantics. Less churn, no broken bookmarks.
Recommend **(b)**. Customers=`/admin/clients`, B2B=`/admin/partners/*`, Deliveries/Bin Rentals/Inbound Shipments survive as additional PRD-missing modules added to the nav under a "Logistics" group.

### C8. Scope out-of-band: Bin rentals, Deliveries, Inbound shipments, Projects, Perks, Tips, Finance, Revenue, Reports, Sales, Widget leads, Claims, Move projects, Activity, Change requests.
Fifteen live modules exist that the PRD does not mention. They are **in production**. We cannot delete them. Options per module:
- Keep current page under new shell without redesign (low effort, inconsistent UX).
- Rebuild under the PRD DataTable/Drawer pattern (consistent, but adds ~2 weeks).
- Archive (remove from nav, keep routes live for deep-links).
I need your call on each group. My default: **keep + visually re-skin under new shell, full rebuild only when someone requests**.

### C9. Package manager.
PRD prompts use `pnpm add …`. Repo uses `npm`. I'll translate every `pnpm` command to `npm install …` and use `npm run typecheck` / `npm run lint`. No `pnpm-lock.yaml` will be added.

### C10. `@radix-ui/react-*` individual packages vs shadcn/ui.
PRD §10.1 mentions "shadcn/ui as component primitive base (Radix under the hood)" but the execution guide installs raw Radix packages. I'll install raw Radix only. No `shadcn/ui` CLI/init. Reason: shadcn copies component source into your repo; you already have your own primitives system to maintain; adding shadcn would add a third style dialect.

### C11. Dark mode baseline.
Current admin is **dark by default, gold accent**. PRD mandates **light by default, dark toggle**. Most admin users are currently signed in to dark. This is a visible change. Do you want:
- **(a)** Flip to light by default (PRD-compliant) and users can toggle to dark.
- **(b)** Honor the user's current preference on first load, default light for fresh installs.
Recommend **(b)** for continuity.

### C12. Recharts is v3 (shipping), PRD assumes v2. Minor — non-blocking. The chart APIs we need (`LineChart`, `Line`, `Tooltip`, `YAxis`, `XAxis`, `Legend`, `CartesianGrid`) are stable. No action.

### C13. No Storybook in repo. PRD §10.8 quality gate #1 says "Storybook story for every new component." Adding Storybook to this stack (Next 16, React 19, React Compiler, Tailwind v4) is a week of its own. Options:
- Skip Storybook; use the `/admin/_dev/primitives` test harness (Prompt 1.6) as the review surface.
- Install Storybook.
Recommend **skip**; use the dev harness. Raise later if desired.

### C14. Em-dashes + emoji in existing copy.
User rule is strict: no em dashes anywhere in UI, no emoji. PRD audit sweep §7.4 agrees. Existing admin copy likely still has both. Phase 7.4 sweep will catch and fix. Not a Phase 1 blocker.

### C15. PRD demands every mutation be "optimistic + rollback + toast".
This is a correctness constraint, not a styling one, and it requires `@tanstack/react-query` + `sonner`. Doable, but every existing hand-rolled fetch in the modules we rebuild needs a migration. I'll only apply this to **newly rebuilt** module pages; legacy pages stay as-is until migrated.

## 7. Realistic scope assessment

Per the PRD itself, this is a **10-week** project. The execution guide is ~40 sub-prompts, each non-trivial. Specific time sinks:

- Phase 1 (tokens + 12 primitives + dev harness): 4–6 days.
- Phase 2 (composites + shell + drawer + modal + floating bar): 3–4 days.
- Phase 3 (DataTable engine, virtualized, URL-synced, responsive card fallback): 4–6 days.
- Phase 4 (Dashboard + 4 core modules): 10–14 days.
- Phase 5 (Crew + Invoices + Dispatch + Calendar): 7–10 days.
- Phase 6 (B2B + PM + Buildings + Analytics + Pricing Engine): 10–14 days.
- Phase 7 (Settings, Search, Notifications, audit sweep, shortcuts): 4–6 days.

Total conservative estimate: **42–60 working days of focused engineering.**

Single chat sessions cannot safely execute this. I need a clear cadence: one sub-prompt at a time, commit + review, next sub-prompt. I will not cram multiple phases into one turn.

## 8. My recommended path forward

1. You answer C3–C11 (7 decisions).
2. I start **Phase 1.1** only: install missing deps (translated to `npm`, Phosphor replaces Lucide), no code changes beyond `package.json`.
3. Run typecheck. Fix peer conflicts. Commit.
4. **Phase 1.2**: admin-scoped token layer in a new file (`src/styles/admin-tokens.css`), imported under an `.ygo-admin` or `[data-admin]` selector. Light + dark. Do **not** touch existing tokens.
5. **Phase 1.3**: skip (Tailwind v4). Instead, add the `@theme` block to the same tokens file so Tailwind v4 sees the semantic color names.
6. **Phase 1.4**: theme provider + Zustand store, applied only inside the admin shell-v2 route group.
7. **Phase 1.5.x**: primitives (Phosphor-based Icon, Button, Chip, Avatar/Stack, Input, Checkbox/Switch/Radio, Dropdown/Popover/Tooltip, Tabs/ToggleGroup/Badge/Skeleton/EmptyState). One file at a time. Each visible in the dev harness before moving on.
8. **Phase 1.6**: `src/app/admin/_dev/primitives/page.tsx` — dev-only — you eyeball everything.
9. Review. Then we talk about Phase 2.

Every phase lands on `main` under `always-main-yugo-ops.mdc`. Commit messages follow your convention: `feat(admin): <what>` — no em dashes in subjects.

---

End of audit. Awaiting decisions on C3, C4, C5, C6, C7, C8, C11. The rest are flagged but have sensible defaults noted above.
