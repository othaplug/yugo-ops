# Yugo+ Admin Rebuild — Phase 0 Audit

Baseline snapshot of the repository before the rebuild begins. Every finding below is derived from the current working tree on branch `claude/cool-noether-708d9a` (worktree of `feat/admin-rebuild` target).

## 1. Stack reality vs. PRD assumptions

| Area | PRD / prompt says | Actual |
|---|---|---|
| Next.js | 14 (App Router) | **16.1.6** (App Router) |
| React | implied 18 | **19.2.3** |
| TypeScript | strict | strict (tsconfig `"strict": true`) |
| Path alias | `/app`, `/components` (root) | **`@/*` → `./src/*`**. All new code must use `src/` layout and `@/` imports. |
| Tailwind | v3 with `tailwind.config.ts` | **v4** (`@import "tailwindcss"` + `@tailwindcss/postcss`). No `tailwind.config.ts` exists. Theme is declared via `@theme` blocks in `src/app/globals.css`. |
| Icons | Lucide (PRD §1.2 rule 11, Phase 1.6) | **`@phosphor-icons/react` ^2.1.10**. Lucide not installed. |
| Package manager | `pnpm` (prompt) | Repo uses `npm` (`package-lock.json` committed, `npm run dev`). |
| Supabase client | `/lib/api/*` | `@/lib/supabase/{server,client}.ts` already in place |
| Database types | `/types/supabase.ts` | **Does not exist.** No generated `Database` type anywhere under `src/`. Existing queries are largely untyped (`from("table")`). |

**Implication:** strict adherence to the prompt's dependency list and folder layout is not possible. Several decisions now need confirmation — see `questions.md`.

## 2. Current admin routes (existing)

Under `src/app/admin/`:

```
/admin                       (page.tsx — dashboard)
/admin/activity
/admin/audit-log
/admin/bin-rentals           + [id], new
/admin/buildings             + [id], new
/admin/calendar
/admin/change-requests
/admin/claims                + [id], new
/admin/clients               + [id], [id]/revenue, new
/admin/crew                  + analytics
/admin/deliveries            + [id], new
/admin/dispatch
/admin/drafts
/admin/finance/forecast
/admin/finance/profitability
/admin/inbound-shipments     + [id], new
/admin/inbox
/admin/invoices              + new
/admin/leads                 + [id], all, mine
/admin/move-projects         + [id]
/admin/moves                 + [id], new, office, residential
/admin/notifications
/admin/partners              + designers, designers/[id], designers/projects,
                               gallery, health, hospitality, new, realtors,
                               retail, statements/[statementId], [partnerId]/billing
/admin/perks
/admin/platform
/admin/projects              + [projectId], new
/admin/quotes                + [quoteId], [quoteId]/edit, new
/admin/reports
/admin/revenue
/admin/sales/pricing-map
/admin/settings              + [tab]
/admin/tips
/admin/users
/admin/widget-leads          + [id]
```

There is **no `(shell)` route group**. Shell wiring lives in `src/app/admin/layout.tsx` → `src/app/admin/components/AdminShell.tsx`.

## 3. Component inventory (existing)

### `src/components/admin/`
- `AdminContextHints.tsx`, `CancelMoveModal.tsx`, **`DataTable.tsx`** (bespoke, phosphor-based, with columns, bulk actions, mobile card layout), `InternalConfigKeyHint.tsx`, `PartnerPortalFeaturesCard.tsx`, `ReferralPartnersOverviewHint.tsx`, `RevenueForecastWidget.tsx`, `SchedulingSuggestion.tsx`, `SectionError.tsx`, `b2b/` (subdir).

### `src/components/ui/`
- `AddressAutocomplete.tsx`, `ConfirmDialog.tsx`, `DraftBanner.tsx`, `InfoHint.tsx`, **`KpiCard.tsx`**, **`Modal.tsx`**, `ModalDialogFrame.tsx`, `MultiStopAddressField.tsx`, `OfflineBanner.tsx`, `PhosphorProvider.tsx`, `SectionDivider.tsx`.

### `src/app/admin/components/` (route-local)
- `AdminShell.tsx`, `Sidebar.tsx`, `Topbar.tsx`, `ThemeContext.tsx`, `Toast.tsx`, `SearchBox.tsx`, `CommandPalette.tsx` (cmdk-style exists already), `NotificationDropdown.tsx`, `NotificationContext.tsx`, `ProfileDropdown.tsx`, `CreateButton.tsx`, `CreateDeliveryDropdown.tsx`, `CreateMovesDropdown.tsx`, `FilterBar.tsx`, `Badge.tsx`, `BackButton.tsx`, `LiveActivityFeed.tsx`, `LiveOperationsCard.tsx`, `ScheduleItem.tsx`, `SegmentedProgressBar.tsx`, `SessionTimeout.tsx`, `SidebarIcons.tsx`, `ModalOverlay.tsx`, `MoveDateFilter.tsx`, `ChangePasswordGate.tsx`, `TwoFAGate.tsx`, `ClientDate.tsx`, `ContactDetailsModal.tsx`, `IncidentsSection.tsx`, `PostCompletionPriceEdit.tsx`, `PendingChangeRequestsContext.tsx`, `RealtimeListener.tsx`, `StatPctChange.tsx`.

### Top-level `src/components/`
- `AppIcons.tsx`, `CollapsibleSection.tsx`, `DeliveryProgressBar.tsx`, `EmbedQuoteCalculator.tsx`, `ProofOfDeliverySection.tsx`, `SafeText.tsx`, `SeasonalPricingPreview.tsx`, `StageProgressBar.tsx`, `TruckMarker.tsx`, `VendorStatusCompactTable.tsx`, `YugoBetaBanner.tsx`, `YugoLogo.tsx`, `YugoMarketingFooter.tsx`, plus module folders: `booking/`, `crew/`, `delivery-day/`, `dispatch/`, `inventory/`, `maps/`, `partner/`, `payments/`, `tracking/`.

None of these primitives match the PRD contract (variants, cva, Radix-backed). Chip/Button/Tabs/Tooltip/Popover/Switch/Radio/ToggleGroup/Dropdown primitives do not exist.

## 4. Design system reality vs PRD §2.1

`src/app/globals.css` currently defines a **dark wine/gold admin theme** (see `--yu-bg-page: #2b0416`, `--yu-accent: #8b1a3a`, `--gold: #c9a962`). The PRD explicitly forbids wine/rose in admin and mandates a **neutral + purple (#5E56F0)** system with light default.

Other conflicts:
- Fonts: `Instrument Sans` / `Instrument Serif` (current) vs **Inter** (PRD).
- Typography scale uses 12/13/16/18/20/22/26/32/40, vs PRD scale with explicit tokens `display-xl` … `numeric-sm`.
- Spacing tokens are not formalized in CSS variables today — ad-hoc Tailwind utilities.
- Theme is currently **dark-default**; PRD requires light-default with dark toggleable.

## 5. Database tables mapped to PRD modules

Table names confirmed by grepping `CREATE TABLE` across `supabase/migrations/` (301 migrations). Subset relevant to PRD modules:

| PRD module | Primary table(s) | Notes |
|---|---|---|
| Leads | `leads`, `lead_activities` | present (`20260329120002_leads_management.sql`) |
| Quotes | `quotes`, `quote_events`, `quote_engagement`, `quote_analytics_*` | present |
| Moves | `moves`, `move_inventory`, `move_photos`, `move_documents`, `move_change_requests`, `move_projects`, `move_waivers`, `move_survey_photos`, `move_modifications` | present |
| Invoices | `invoices`, plus payment-tracking columns | present |
| Customers (B2C) | `clients` (existing admin route) | PRD uses "customers" terminology. Mapping: `/admin/customers` → existing `clients` table. |
| B2B Partners | `partners` + partner_* tables; verticals as `/admin/partners/designers`, `hospitality`, `realtors`, `retail`, `gallery` | present |
| Property Management | no dedicated `pm_*` tables found in quick grep; likely reuses `partners` with a type flag + `building_profiles` | **needs confirmation**. PRD §5.8 calls for a PM table; current schema may not have one. |
| Buildings | `building_profiles` (`20260418140000_building_profiles.sql`) | present |
| Crew | `crew_members`, `crews`, `crew_locations`, `crew_location_history`, `crew_schedule_blocks`, `crew_session_*` | present |
| Dispatch | `crew_locations` + `moves` status fields; no dedicated dispatch table | present by composition |
| Calendar | `crew_schedule_blocks`, `duration_defaults` | present |
| Pricing Engine | `platform_settings`, `platform_config` (pricing), `rate_cards_*`, `platform_truck_fees`, `core_pricing_schema` | present |
| Analytics | no single table — composed from `quote_events`, `notification_log`, `moves`, `invoices`, etc. | derived |
| Audit log | `audit.ts` lib + audit rows on domain tables | present |
| Settings → Integrations | none centralized; integrations (HubSpot, Square, Twilio, Mapbox) are config/env-driven | out of DB |

A full table inventory is larger than needed for Phase 0; the first-200 grep is at `_yugo-rebuild/_tables-first-200.txt` if regenerated. All modules the PRD requires have a corresponding table or derivable composition.

## 6. Gaps (PRD requires X, repo is missing X)

1. **No generated Supabase types.** `/types/supabase.ts` does not exist. Phase 1 / 4 will need `supabase gen types typescript` (or a local types file checked in) before module pages can be strongly typed.
2. **No Radix primitives installed.** `@radix-ui/*` packages absent. All of the Phase 1.6 atoms (Checkbox, Switch, Radio, Tooltip, Dropdown, Popover, Tabs, ToggleGroup, Dialog-based Drawer/Modal) need the dependency block from Phase 1.1.
3. **No TanStack Query, Zustand, sonner, cva, tailwind-merge, clsx, react-hook-form, zod-resolvers, react-virtual, date-fns, cmdk.** Some (zod, recharts, mapbox-gl) are already present and reusable.
4. **No design-token stylesheet matching PRD §2.1.** `tokens.css` does not exist. Current tokens are a different system entirely.
5. **No `components/primitives`, `components/composites`, `components/layout`, `components/modules`, `components/providers` folders.** All new code will create these.
6. **No column-driven DataTable matching PRD §5.** Existing `src/components/admin/DataTable.tsx` is column-driven but uses a different contract (`ColumnDef<T>` w/ accessor/render, not `ColumnConfig<T>` w/ type). It does not support sparkline/indicator/identity cell types, saved views as tabs, URL-synced state, or virtualization.
7. **No `/app/admin/(shell)` route group.** Existing admin layout is flat.
8. **No PM (Property Management) route** at `/admin/pm`. PRD §6.2 requires one.
9. **No `/admin/b2b` route.** PRD §6.1 requires one; current code has per-vertical routes under `/admin/partners/*`.
10. **No `/admin/analytics` route.** Reports exist at `/admin/reports`, revenue at `/admin/revenue`, finance at `/admin/finance/*`.
11. **No `/admin/pricing` top-level route.** Pricing data lives under `/admin/platform` and `/admin/sales/pricing-map`.
12. **No `/admin/fleet`, `/admin/help` routes** (PRD sidebar config includes Fleet; §7.4 requires a shortcuts help page).
13. **No Inter font load.** Current font stack is Instrument Sans/Serif via `next/font` (needs verification in `src/app/layout.tsx`).
14. **No `data-theme="dark"` mechanism.** A `ThemeContext` exists but its contract and persistence key are not `yugo-theme`.
15. **No `feat/admin-rebuild` branch.** Current work is on `claude/cool-noether-708d9a` (worktree).

## 7. Conflicts (existing X does not match PRD §Y)

| # | Conflict | PRD reference | Resolution (default) |
|---|---|---|---|
| C1 | Icons: Phosphor everywhere vs Lucide-only | PRD §1.2 (rule 11), Phase 1.6 | **Open question.** Ripping Phosphor out of ~60+ files is a separate, large refactor. Default: install Lucide for *new* primitives and new module pages; leave Phosphor usages untouched in out-of-scope legacy files. Document migration as a separate task. |
| C2 | Dark wine/gold theme vs neutral + purple #5E56F0 | PRD §0, §2.1 | **Open question.** New `tokens.css` and admin shell must replace the wine palette wholesale. Conflicting CSS in `globals.css` must be removed or scoped so the two systems don't collide. |
| C3 | Tailwind v4 (no config.ts) vs prompt's `tailwind.config.ts` snippet | Phase 1.3 | Use Tailwind v4 `@theme` block in `tokens.css` or `globals.css` instead of a `tailwind.config.ts`. Semantic utility names (`bg-surface`, `text-primary`, etc.) achievable via `@theme` custom properties. |
| C4 | Existing `DataTable` (`src/components/admin/DataTable.tsx`) contract ≠ PRD §10.4 | PRD §5, §10.4 | Build new DataTable at `src/components/composites/DataTable/` per PRD. Migrate call sites module-by-module during Phase 4-7. Old component stays until all callers are migrated, then deleted. |
| C5 | Existing `Modal`, `KpiCard`, `ConfirmDialog`, `CommandPalette` primitives | PRD §3, §7 | Replace incrementally. New versions at `components/primitives/` and `components/composites/`. Old ones stay until route migration. |
| C6 | Existing `AdminShell` / `Sidebar` / `Topbar` at `src/app/admin/components/` vs PRD `components/layout/` | PRD §4, Phase 2.2 | Build PRD-spec shell at `src/components/layout/AdminShell.tsx`. Switch `src/app/admin/layout.tsx` to use it only after the new shell reaches parity with the existing (notifications, command palette, 2FA/change-password gates, realtime listener, session timeout). |
| C7 | `npm` vs `pnpm` in Phase 1.1 | Phase 1.1 | Use `npm install` for dependencies. |
| C8 | Terminology: PRD "Customers" vs repo "Clients" (`/admin/clients`, `clients` table) | PRD §5.8, §7.3 | **Open question.** Keep DB table name `clients`, alias to "Customers" in UI. New route at `/admin/customers` acts as the PRD canonical surface; existing `/admin/clients` can redirect or coexist. |
| C9 | PRD B2B: single `/admin/b2b` with 11 verticals in table vs repo's per-vertical routes (`designers`, `hospitality`, `realtors`, `retail`, `gallery`) | PRD §6.1 | Build unified `/admin/b2b` with `VERTICAL` column filter. Keep per-vertical routes as pinned saved views (PRD §5.7). |
| C10 | PRD "Fleet" sidebar item; repo has no `/admin/fleet` route | PRD §4.2 | Create stub route during Phase 5 (or defer to questions). Table `fleet_vehicles_and_allocation` exists (`20250281000000`) so data is available. |
| C11 | Existing `src/app/admin/layout.tsx` is async server component with auth gates (2FA, password change); PRD `(shell)/layout.tsx` is silent on these | Phase 2.3 | Preserve existing auth/gate logic. The new shell wraps *inside* those gates. Do not remove `ChangePasswordGate` / `TwoFAGate`. |
| C12 | Existing `ThemeContext` and its persist key | Phase 1.5 | Replace with Zustand-persist ThemeProvider. Migrate existing `ThemeContext` consumers in a dedicated commit. |
| C13 | Current default theme is dark; PRD mandates light-default | PRD §0 | Flip default on rebuild cutover. Persisted-dark for existing users keeps their preference. |
| C14 | PRD "No em dashes in copy" but prompt itself contains several; many existing UI strings use them | PRD quality rule 6 | New components: no em dashes. Legacy copy: linted and fixed during polish pass (Phase 7.4). |
| C15 | PRD "No emoji in UI"; verify none in existing strings | PRD §1.2 rule 11 | Scan in Phase 7.4 polish. |

## 8. Suggested sequencing adjustments

1. Before Phase 1 starts, resolve the blocking questions in `_yugo-rebuild/questions.md`. A rebuild of this scope built on wrong answers is wasteful.
2. Phase 1 must add: generate Supabase types, install deps (adjusted list for TW v4 / no `tailwind.config.ts`), author `tokens.css` via `@theme`.
3. Phase 2's `(shell)` route group can be introduced as a sibling of the existing `admin/layout.tsx` via the Next.js route-group convention, so the old and new shells can be toggled per route during migration. Alternative: build the new shell first and swap in a single commit.
4. DataTable migration (Phase 3 → Phase 4-7) should go module by module, deleting the old component only after every call site moves.
5. Branch: create `feat/admin-rebuild` and push the audit commit there.

## 9. Acceptance-check notes

- No `_yugo-rebuild/audit.md` existed prior. Now present.
- `git status` clean before writing audit.
- `git log --oneline -20` shows 20 recent commits on the worktree branch (all named `"update"` — consider more descriptive messages going forward per the Conventional Commits rule).

*End of audit.*
