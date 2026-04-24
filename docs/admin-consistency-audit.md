# Yugo+ admin consistency audit

Scope: `src/app/admin/**`, `src/design-system/admin/**`, `src/styles/**`, plus
admin-specific components under `src/components/admin/**`.
Date: 2026-04-24
Branch: `fix/admin-consistency-sweep`

This is the Phase 1 deliverable. Every finding here is a fix candidate for
Phase 2. Phase 2 is broken into 14 commits; each one references the section
of this audit it addresses.

The audit answers four questions on every domain:

1. Where is it inconsistent?
2. What are the variants that exist today?
3. What is the canonical answer (single rule)?
4. What changes — concretely — to get there?

---

## 1.1 Typography audit

### 1.1.1 Type scale today

Three parallel scales coexist:

| Source | Owner | Sizes |
| --- | --- | --- |
| `src/styles/tokens.css` (canonical, **not yet fully consumed**) | v3 plan | display 28/36, heading 18/26, body 14/20, label 11/14, annotation 12/16 |
| `src/styles/admin-tokens.css` `@utility` set | admin-v2 era | display-xl 36, display-lg 30, display-md 24, heading-lg 20, heading-md 16, heading-sm 14, body-lg 16, body-md 14, body-sm 13, body-xs 12, label-md 12, label-sm 11, numeric-lg 30, numeric-md 16, numeric-sm 13 |
| Inline Tailwind `text-[NNpx]` and ad-hoc font-size classes across `src/app/admin/**` | scattered | text-[10px], text-[11px], text-[12px], text-[13px], text-[14px], text-[15px], text-[16px], text-[18px], text-[24px], text-[28px], text-[30px], text-[32px] |

Result: **5 canonical sizes** (`tokens.css`), but pages keep adding raw px
values bypassing the tokens. Net effect: at least 12 distinct font-size
values render across admin.

### 1.1.2 Font family — serif misuse on operational pages

Per the user-reported visual review:

| Page (URL) | Title font | Title size | Notes |
| --- | --- | --- | --- |
| `/admin` (Command Center) | sans, eyebrow + title | 28px | **Reference page — correct** |
| `/admin/buildings` | serif | display-scale | Inconsistent serif on operational page |
| `/admin/bin-rentals` | serif | tiny (sub-heading scale) | Same serif treatment, but undersized |
| `/admin/revenue` | serif | display | Operational |
| `/admin/finance/profitability` | serif | display | Operational |
| `/admin/crew/analytics` (overview heading "Crew Performance") | serif | display | Operational |
| `/admin/dispatch` | sans, no description | display | Missing description copy |
| `/admin/calendar` | none | — | **No PageHeader at all** |
| `/admin/partners` | sans (good) | display | Already correct |
| `/admin/quotes` | sans (good) | display | Already correct |
| `/admin/widget-leads` | sans (good) | display | Already correct |
| `/admin/moves` | sans (good) | display | Already correct |
| `/admin/perks` | sans, mini | label-scale | Title is too small — reads like a section header |
| `/admin/audit-log` | sans (good) | display | Already correct |

**Finding:** there is no rule for serif. It appears on operational pages
("Buildings", "Bin Rentals", "Revenue", "Profitability", "Crew Performance")
which are list/data pages — exactly the pages where serif was never the right
treatment.

The premium quote system uses serif intentionally (premium client journey);
that is fine and out of scope. Inside `/admin/*`, serif must be retired.

**Canonical rule:** `var(--font-sans)` for every `/admin/*` page title. Serif
is reserved for the sidebar wordmark (`Yugo+`) and the move/customer detail
hero name (cinematic treatment), not operational page chrome.

### 1.1.3 Weight + tracking inconsistency

Common drift across admin:

- Eyebrow labels render as `text-[10px]`, `text-[11px]`, and `text-[12px]`
  with tracking values from `tracking-[0.04em]` through `tracking-[0.12em]`.
- Display titles render at 24, 28, 30, 32, 36px depending on the page.
- Numeric values in stat cards inherit `font-weight: 600` in some places,
  `font-weight: 700` in others, and `font-weight: 500` in `numeric-md` zones.
- Tabular figures (`tnum`) are applied via `.yu3-num` on dashboard widgets
  but are missing from many table cells, profitability tables, and KPI
  numbers in legacy clients.

### 1.1.4 Concrete fix list (Phase 2 §2.6)

- `PageHeader`: drop `variant="hero"`'s special serif path entirely. Title
  is always sans, weight 600, 28px/36px. Hero variant becomes a simple
  spacing variant.
- Add `tabular-nums` (`.yu3-num`) to every numeric column / KPI value via
  the `StatCard` and `DataTable` primitives.
- Replace raw `text-[NNpx]` for headings with the v3 utilities
  (`yu3-t-display`, `yu3-t-page`, `yu3-t-section`, `yu3-t-eyebrow`,
  `yu3-t-body`, `yu3-t-meta`).

---

## 1.2 Color audit

### 1.2.1 Wine

Used for:

- Sidebar brand mark, active nav left accent bar, active row background tint.
- Primary CTAs across admin: "+ New move", "+ New quote", "+ Add partner",
  "Add referring partner", "Invite User", "Save Changes".
- A donut-segment fill on the Command Center "Revenue mix" gauge
  (`var(--yu3-wine)` for `Moves`).
- A status-bar fill on the "Quote Pipeline" breakdown for the *Open* row
  (`var(--yu3-wine)`).
- A "PAID" status pill on Dispatch.

**Drift to fix:** Wine on data viz (Revenue mix Moves segment, Quote pipeline
Open bar) is decorative use of a brand color — this conflicts with §2.13.
Wine on a "PAID" pill conflicts with the semantic rule that *paid = success
(green)*.

### 1.2.2 Gold / tan / brown — the biggest offender

There is no canonical `--gold` hex. Two parallel systems define it:

| Token | Source | Value (light) | Notes |
| --- | --- | --- | --- |
| `--gold` (CSS root) | `src/app/globals.css:34` | `#c9a962` | Used by the legacy admin chrome and quote forms. Cascades into admin. |
| `--color-accent` (admin theme) | `src/styles/admin-tokens.css:31` | `#5e56f0` | Purple-leaning indigo. The admin-v2 plan accent. |
| `--admin-primary-fill` | bridge in `admin-tokens.css:255` | `var(--color-accent)` | Currently maps onto the indigo, not the gold. |

In production light mode, the **gold** that the user sees in screenshots
("Live Map", "EOD Reports", "+ Schedule", chart bars, "TOP PERFORMER" label,
Crew Comparison progress bar) renders at `#c9a962` (or close — Tailwind
arbitrary `bg-[var(--gold)]` resolves to that).

**~140 admin files** include `var(--gold)` or related tokens (full list
captured in section 1.2.7). Verified hot spots:

| Surface | File | Role |
| --- | --- | --- |
| "Live Map" CTA | `src/app/admin/dispatch/DispatchBoardClient.tsx` | Primary action — wrong color |
| "EOD Reports" CTA | `src/app/admin/crew/analytics/CrewAnalyticsClient.tsx` | Secondary action — wrong color |
| "+ Schedule" button | `src/app/admin/calendar/components/MonthView.tsx` (and DayView/YearView) | Primary action — wrong color |
| Add deliveries `+` square | `src/app/admin/deliveries/AllProjectsView.tsx` | Primary action presented as icon-only — wrong color, wrong shape |
| "Quote widget" button | `src/app/admin/widget-leads/...` (in `partners/AllPartnersClient.tsx`) | Tertiary link — wrong color |
| "Generate quote" on bin rental | `src/app/admin/bin-rentals/BinRentalsClient.tsx` | Primary — wrong color, *and* wrong button level |
| "Add building" button | `src/app/admin/buildings/...` | Primary — wrong color, *and* presented as secondary |
| "TOP PERFORMER · Alpha" name | `src/app/admin/crew/analytics/CrewAnalyticsClient.tsx` | Decorative tinting — should be neutral text |
| Performance Trends bar chart | same file | Data series — should be near-black |
| Crew Comparison progress bar | same file | Data series — should be near-black |
| "Profit by Tier" bars | `src/app/admin/finance/profitability/ProfitabilityClient.tsx` | Mix of gray + dark green — see §1.9 |
| Audit log "All" filter chip | `src/app/admin/audit-log/AuditLogClient.tsx` | Selected state — wrong color |
| Tip earnings/positive accents | `src/app/admin/tips/TipsClient.tsx` | Decorative — wrong color |

**Canonical rule:** retire gold completely from `/admin/*`. There is one
brand color (wine) and one ink color (near-black). Decorative gold has no
home in this product. See §2.2 for replacement rules.

### 1.2.3 Green semantic overload

`green` (token `--yu3-success` / `--color-success-fg` / arbitrary
`#0F7A3F`) renders for:

- "PAID" badge — payment success ✓ (correct)
- "ACCEPTED" quote — sales success ✓ (correct)
- "DELIVERED" delivery — fulfillment success ✓ (correct)
- "COMPLETED" move — operational success ✓ (correct)
- "ACTIVE" partner — partnership state ✓ (correct enough — partner is
  successfully onboarded)
- "SCHEDULED" move — **wrong**, this is a planned state, not a successful
  one. Should be info (blue) or neutral (gray).
- "CONFIRMED" bin rental — **borderline**. We treat confirmed as success in
  the canonical map (§2.5).
- Revenue numbers in the Revenue page header (`$3.0K`, `$1.5K`) — **wrong**,
  decorative tinting of money values. Money should use neutral ink unless
  it's a delta.
- "REVENUE THIS MONTH" sparkline trail tint — decorative.

**Canonical rule:** green is reserved for *success* — completed, paid,
accepted, delivered, active. Not for planning states. Not for raw money
values. Not for decorative trend strokes (use ink-strong instead).

### 1.2.4 Red semantic overload

Red appears for:

- "EXPIRED" quote — expiry ✓ (correct)
- "COLD" quote — should be **neutral**. Cold is not danger.
- "NEW" widget lead count — **wrong**, "new" is not danger. Should be
  neutral.
- "ON-TIME RATE 50%" in crew analytics — **wrong**, 50% is poor but not
  critical. Should be amber.
- "3 Issues" pinned banner in screenshots — this is the Next.js dev
  indicator (bottom-left), not in our source. Out of scope. (Captured in
  §1.12 for completeness.)

**Canonical rule:** red == failed, over-limit, blocking error. Not "new",
not "cold", not "below average".

### 1.2.5 Blue semantic overload

Blue is used for:

- "MOVE" type chip on Dispatch — info (correct)
- "CONFIRMED" bin rental status text-only — **inconsistent**, this is a
  successful state and should be green
- "24" today indicator in calendar — info (correct)
- "Assigned" KPI on Dispatch — should be neutral (it's a count)

### 1.2.6 Hex literals not via tokens

Searched `/src/app/admin/**` for `#[0-9a-fA-F]{3,6}` excluding tokens.css and
admin-tokens.css. Not exhaustive list — representative offenders:

| File | Hex |
| --- | --- |
| `src/app/admin/finance/profitability/ProfitabilityClient.tsx` | `#22c55e`, `#facc15`, `#ef4444`, `#ffffff` |
| `src/app/admin/crew/CrewMap.tsx` | `#5C1A33`, multiple stage hexes |
| `src/app/admin/calendar/components/{Month,Day,Week,Year}View.tsx` | event color hexes |
| `src/app/admin/dispatch/DispatchBoardClient.tsx` | crew status hexes |
| `src/app/admin/clients/[id]/AdminPartnerAnalytics.tsx` | chart color hexes |

**Canonical rule:** in `/admin/*` no hex literals. Everything goes through
tokens (`--yu3-*` for the v3 surface, `--color-*` for the canonical `tokens.css`).

### 1.2.7 Gold-token usage breadth

`rg "var\(--gold\)" src/app/admin -l | wc -l` → ~140 files. Replacing every
file by hand is not the right strategy. The right strategy is:

1. Re-map the `--gold` token to wine inside the admin scope so the bulk
   change is a single CSS edit.
2. Surgically retarget the 6 explicit cases that should not become wine:
   - Performance Trends bars → ink-strong
   - Crew Comparison progress bar → ink-strong
   - "TOP PERFORMER" label color → ink-strong / neutral chip
   - "Profit by Tier" bars → ink-strong
   - Audit log selected-filter chip → wine wash + wine text
   - Quote widget link button → secondary (border + text-primary)

This is the approach the Phase 2 §2.2 commit takes.

---

## 1.3 Button audit

There are at least four button systems coexisting:

1. **v3 `Button` primitive** — `src/design-system/admin/primitives/Button.tsx`.
   Variants: `primary`, `accent`, `secondary`, `ghost`, `destructive`,
   `link`, `dark`. Sizes: xs, sm, md, lg, icon, iconSm, iconXs.
2. **Legacy "btn-*" classes** under `src/styles/legacy-admin.css` (still
   referenced).
3. **Tailwind one-offs** — every page rolls its own `bg-[var(--gold)]
   text-white px-3 py-1 rounded-md` style.
4. **Modal action buttons** — many modals use a thin custom button shape.

### 1.3.1 Inventory of CTAs across the user-reviewed screens

| Page | Label | Today's variant | Canonical |
| --- | --- | --- | --- |
| Command Center | Refresh | secondary (border, white) | secondary ✓ |
| Command Center | + New move | primary (wine) | primary ✓ |
| Dispatch | Refresh just now | secondary | secondary ✓ |
| Dispatch | Live Map | gold filled (decorative) | **primary (wine)** |
| Calendar | + Schedule | gold filled | **primary (wine)** |
| Crew Analytics | EOD Reports | gold filled | **secondary** |
| Crew Analytics | Crews dropdown | secondary | secondary ✓ |
| Quotes | + New quote | primary (wine) | primary ✓ |
| Widget Leads | Quote widget | secondary outlined | secondary ✓ |
| All Moves | + New move | primary (wine) | primary ✓ |
| Bin Rentals | Generate quote | white outlined | **primary (wine)** |
| Buildings | Add building | white outlined | **primary (wine)** |
| Partners | + Add partner | primary (wine) | primary ✓ |
| Partners | Partner health | secondary | secondary ✓ |
| Referral Partners | + Add referring partner | gold filled | **primary (wine)** |
| Referral Partners | Add Realtor | secondary | secondary ✓ |
| Jobs / All Deliveries | `+` icon-only square | gold filled, icon-only | **primary (wine) with label "Add delivery"** |
| Revenue | All Invoices | ghost arrow | ghost ✓ |
| Profitability | Export CSV | secondary | secondary ✓ |
| Profitability | Save Changes | gold filled | **primary (wine)** |
| Perks & Referrals | `+` icon-only square | gold filled, icon-only | **primary (wine) with label "Add offer"** |
| Audit log | Export | secondary | secondary ✓ |
| Audit log | Save view | secondary | secondary ✓ |
| Buildings edit | Save | (varies; sometimes gold) | **primary (wine)** |
| Quotes detail | Send quote | mixed | **primary (wine)** |

### 1.3.2 Findings

- 7 CTAs use gold filled buttons — all incorrect.
- 3 primary actions are presented in secondary styling (Bin rentals
  "Generate quote", Buildings "Add building", "Save Changes" on
  Profitability).
- Icon-only `+` buttons on Jobs, Perks, Revenue. Icon-only is reserved for
  chrome (sidebar collapse, dark mode, bell, avatar). Primary actions need
  text labels.
- The v3 `Button` primitive has 7 variants; per the user direction we
  collapse to **3** (`primary`, `secondary`, `ghost`) in Phase 2 §2.3, with
  `destructive` retained as a tone modifier on `secondary`.

---

## 1.4 Stat card audit

| Page | Card style | Label position | Number font | Border | Notes |
| --- | --- | --- | --- | --- | --- |
| Command Center top KPI strip | borderless tiles, border-bottom of card group | uppercase eyebrow above | 28px tabular | thin border on the card group | **Reference — correct** |
| Command Center "Today earnings / Active quotes / Client rating / Leads this month" | borderless tiles inside `SparkPanel` | eyebrow above | 24–28px | thin card border | Sparkline only on 2 of 4 — see §2.13 |
| Dispatch top "Jobs Today / Active Crews / Completed / Assigned" | borderless tiles, but with semantic text colors | eyebrow above | 36px | none | Numbers use semantic colors (green/red/blue) — should be neutral |
| Quotes "Total / Open / Open Value / Accepted" | borderless | eyebrow above | 28px | thin border on the card | One card has a vertical red dot accent — no documented reason |
| Widget Leads "Total / New / In Progress / Booked" | borderless | eyebrow above | 28px | thin border | "NEW" rendered red — wrong |
| All Moves "Total / Active / Completed / Avg Margin / Booked Estimate" | borderless | eyebrow above | 28px | thin border | Mixes count + currency + percentage in same row visually |
| Bin Rentals (no top KPI strip) | — | — | — | — | Goes straight to table, no KPI summary |
| Buildings "High complexity / Unverified" | borderless tiles, only 2 | eyebrow above | 28px | thin border | KPI count is small (2 cards) |
| Profitability top row | borderless tiles | eyebrow above | varies (gross margin uses green) | thin border | Money values colored green decoratively |
| Crew Analytics overview | inline-stat row, no cards | eyebrow before, value after, all in one line | 14–16px | none | Completely different treatment |
| Crew Analytics detail | bordered cards but with on-time-rate red | eyebrow above | 28px | full border per card | 50% rate rendered in red — wrong tone |
| Perks & Referrals "Active perks / Referrals / Used / Conversion" | inline-stat row, no cards | eyebrow above (small caps) | 28px green | none | Single horizontal strip, big disconnect from other pages |
| Audit log (no top KPI) | — | — | — | — | Lists events, no KPI |
| Partners "Total / Active / Joined 90 / Needs attention" | bordered cards | eyebrow above | 28px | full border per card | Closest to canonical aside from Command Center |
| Referral Partners "Total / Booked / Commission / Realtors" | bordered cards | eyebrow above | 28px | full border | OK |
| All Deliveries "Total / Pending Approval / Completed / In progress" | bordered cards | eyebrow above | 28px | full border | OK |
| Revenue "April / 2026 YTD / Outstanding / Avg Job Value" | borderless tiles, with green ink on money | eyebrow above | 28px | thin border | `$0` rendered green ("Outstanding") — wrong |

**Five visual treatments:** bordered cards, borderless tiles in a thin-border
group, inline-stat rows, single horizontal-strip rows, ad-hoc per-page
grids. Per user direction, we collapse to one canonical `StatCard` (Phase 2
§2.4).

---

## 1.5 Chip / status pill audit

### 1.5.1 The semantic mess

| Label | Where it appears | Today's tone |
| --- | --- | --- |
| `PAID` | Dispatch | wine fill, white text |
| `ESSENTIAL` / `SIGNATURE` / `ESTATE` | Move tier on Dispatch + All Moves | pink fill, wine text (varies) |
| `MOVE` / `DELIVERY` type | Dispatch + Audit log | light blue fill, blue text |
| `SCHEDULED` | All Moves | green fill |
| `COMPLETED` | All Moves | green fill (same color) |
| `ACCEPTED` | Quotes | green fill |
| `EXPIRED` | Quotes | red fill (correct) |
| `COLD` | Quotes | gray fill (correct) |
| `ACTIVE` | Partners | green outline |
| `CONFIRMED` | Bin rentals | blue text-only, no chip |
| `DELIVERED` | All Deliveries | green text only |
| `IN PROGRESS` | All Moves | various, sometimes orange |
| `NEW` | Widget Leads (count) | red number — not a pill but functions like one |
| `TOP` (performer) | Crew analytics | gold pill |

Same shape (pill) is rendered with: solid fill, outline, text-only-no-pill,
and text-only-with-color. Same color (green) means "scheduled", "completed",
"accepted", "active", "delivered" — five different states.

### 1.5.2 Canonical mapping (Phase 2 §2.5)

| Tone | Use for |
| --- | --- |
| `neutral` (gray) | drafts, cold, top performer label, other neutral state |
| `info` (blue) | move/delivery type, scheduled (planned, not yet done) |
| `success` (green) | paid, accepted, delivered, completed, confirmed, active |
| `warning` (amber) | expires soon, approaching limit, on-time below 80% |
| `danger` (red) | failed, expired, over-limit, errored |
| `brand` (wine tones) | tier labels only (Essential, Signature, Estate) |

Visual: `var(--color-{tone}-bg)` background, `var(--color-{tone}-fg)`
text, `radius-sm` (6px), 11px label-style, 0 vertical padding, 6px
horizontal. No outline by default.

---

## 1.6 Table audit

| Page | Row height | Header style | Cell padding | Empty cell | Hover | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| All Moves | ~52px | uppercase, tracking, gray | 12px | "—" dash | row tint | OK |
| Quotes | ~52px | uppercase, tracking, gray | 12px | "—" dash | row tint | OK |
| Widget Leads | ~64px | uppercase, no tracking | 16px | blank | none | Different row height + no hover |
| Partners | ~52px | uppercase | 12px | blank | tint | OK |
| Referral Partners | ~52px | uppercase | 12px | "—" | tint | OK |
| Bin Rentals | ~56px | uppercase | 14px | "—" | tint | OK |
| All Deliveries | ~48px | uppercase | 10px | "—" | tint | Tighter rows |
| Crew Analytics job history | ~64px | uppercase, with badges | 16px | "—" | none | Tallest rows; "X" red marker for off-time |
| Audit log | ~44px | uppercase | 8–10px | blank | tint | Tight rows |
| Profitability per-job | ~44px | uppercase | 8px | "—" or 0 | tint | Tightest |

Row heights vary 44 → 64px (4 distinct heights). Empty-cell rendering varies
(`—` vs blank vs "0"). Hover varies (with vs without). All four are
unified in Phase 2 §2.9.

---

## 1.7 Form field audit

| Component | Background | Border | Radius | Height | Where |
| --- | --- | --- | --- | --- | --- |
| `Input` (v3 primitive) | surface | 1px line | 8px (md) | 36–40px | New v3 forms |
| Legacy admin input | surface-subtle | 1px line | 6–8px | 36–44px | Most existing admin forms |
| Search bar (top of pages) | surface | 1px line | 9999px (full pill) | 36px | Quotes, Partners, Bin Rentals, etc. |
| Filter dropdown (calendar, audit log) | surface | 1px line | 8px | 32px | Smaller dropdown chip |
| Edit Building textarea | surface | 1px line | 8px | auto | OK |
| Quote builder field | underline only, no border | 1px bottom only | 0 | 32px | Underline-style field — different language |

Three radii (6, 8, 9999), three heights (32, 36, 40+), and two distinct
treatments (full-pill search vs. bordered rectangle). Recommended: rounded-md
(8px) everywhere, 40px height. Search bar gets a magnifying glass affordance
but the same shape as other fields.

---

## 1.8 Page header audit

| Page | Eyebrow | Title font | Description? | Action location | Action color |
| --- | --- | --- | --- | --- | --- |
| Command Center | OPERATIONS / COMMAND CENTER | sans 28px | yes | top-right | Refresh secondary + New move primary ✓ |
| Dispatch | OPERATIONS | sans 28px | **no** | top-right | gold Live Map ✗ |
| Calendar | (none) | (no title) | **no** | top-right | gold + Schedule ✗ |
| Crew Analytics | OPERATIONS | serif | **no** | top-right | gold EOD Reports ✗ |
| Quotes | PIPELINE | sans | yes | top-right | wine New quote ✓ |
| Widget Leads | SALES | sans | yes | top-right | secondary Quote widget ✓ |
| All Moves | OPERATIONS | sans | yes | top-right | wine New move ✓ |
| Bin Rentals | OPERATIONS | serif (small) | yes | top-right | secondary Generate quote (should be primary) |
| Buildings | (none) | serif + icon | yes | top-right | secondary Add building (should be primary) |
| Partners | CRM | sans | yes | top-right | wine Add partner ✓ |
| Referral Partners | PARTNERS | sans (subtitle) | yes | top-right | gold Add referring partner ✗ |
| Jobs (Deliveries) | B2B OPERATIONS | sans | yes | top-right | gold `+` ✗ |
| Revenue | FINANCIAL OVERVIEW | serif | (no description) | top-right | secondary All Invoices ✓ |
| Profitability | FINANCE | serif | yes | top-right | secondary Export CSV ✓ |
| Perks & Referrals | GROWTH | sans (small) | (no description) | top-right | gold `+` ✗ |
| Audit log | OPERATIONS | sans | yes | top-right | secondary Export ✓ |
| Platform | PLATFORM | sans | (no description) | top-right | secondary | After today's fix |

**Fix list:**

- 5 pages need a description (Dispatch, Calendar, Crew Analytics, Revenue,
  Perks & Referrals).
- 1 page needs a title at all (Calendar).
- 6 pages need serif retired on the title.
- 5 pages need their action button retoned (gold → wine or gold → secondary).
- The PageHeader component itself is fine; we adjust callers, not the
  primitive.

---

## 1.9 Chart / data-viz audit

| Chart | Today's color | Canonical |
| --- | --- | --- |
| Command Center Revenue mix donut — Moves segment | wine | **ink-strong (near-black)** |
| Command Center Revenue mix donut — Partner segment | forest | **success-fg (green)** |
| Command Center Revenue mix donut — phantom tick marks | rendered | **removed** |
| Command Center Revenue mix donut — segment gap | visible | **closed** (drop the line-cap) |
| Command Center Revenue mix center delta `+100.0%` | unstyled | **success-fg green when positive, danger when negative** |
| Command Center Quote Pipeline — Open bar | wine | **neutral-fg gray** |
| Command Center Quote Pipeline — Viewed bar | forest | **info-fg blue** |
| Command Center Quote Pipeline — Accepted bar | info-fg | **success-fg green** |
| Command Center Quote Pipeline — Expiring bar | warning-fg | warning ✓ |
| Today Earnings sparkline | gold | **ink-strong** |
| Active Quotes sparkline | gold | **ink-strong** |
| Client Rating | (none) | **add ink-strong sparkline** |
| Leads This Month | (none) | **add ink-strong sparkline** |
| Crew Capacity progress bars | green/amber/red by load | retained ✓ but `0/0` cells render "Not scheduled" instead |
| Revenue trend bar chart (Revenue page) | dark green + wine alternating | **ink-strong solid** |
| Revenue by source horizontal split (Revenue page) | warning-fg + success-fg | retained — these *are* semantically distinct sources |
| Profitability "Profit by Tier" bars | gray + dark green | **ink-strong** |
| Crew Analytics "Performance Trends" bars | gold | **ink-strong** |
| Crew Analytics Crew Comparison bar fill | gold | **ink-strong** |

**Rule:** default data series color is `--color-text-primary` (near-black).
Semantic color is reserved for cases where the bar represents a semantic
state (Revenue-by-source qualifies because it splits two distinct income
streams; Profit-by-Tier does not).

Axes / gridlines / ticks: `--color-text-tertiary`.

---

## 1.10 Sidebar nav audit

The sidebar in `src/design-system/admin/layout/Sidebar.tsx` is closest to
correct. Findings:

| Item | Today | Canonical |
| --- | --- | --- |
| Section eyebrow | `yu3-t-eyebrow`, 11px, tracked | ✓ |
| Item height | `h-9` (36px) | ✓ — confirmed identical across all sections |
| Icon style | Phosphor outline | ✓ — but `Inbound Shipments` uses `ShippingContainer` which renders a small box-grid that looks denser than peers. Replace with `Truck` or `PackageArrow` |
| Active state | wine wash + 2px wine left bar | wine wash + **3px** wine left bar + text weight 600 |
| Active text | `var(--yu3-ink-strong)` | bump weight to 600 |
| "3 Issues" badge | bottom-left | This is the **Next.js dev indicator**, not in our source. Out of scope. The "Ops intelligence" panel above it *is* in our code (`Sidebar.tsx:268`) and is fine. |

---

## 1.11 Empty state audit

Per-page state when data is empty:

| Surface | Today | Canonical |
| --- | --- | --- |
| Crew Analytics "Total Tips" KPI | "—" | hide if untracked, render `$0` muted if tracked-but-zero |
| Crew Analytics "On Time" column | "—" rows | render blank |
| Crew Analytics "Rating" column | "—" rows | render blank |
| All Moves "Crew" column | sometimes "—" | blank |
| Crew Capacity tiles | `0/0` + empty progress | "Not scheduled" muted, hide progress bar |
| Quote pipeline conversion when 0 viewed | bars at 0% | retain with muted text under the row |
| Today's jobs section when empty | "No jobs scheduled today." | retain — already a good empty-state |
| Recent activity | `EmptyState` | retain |
| Bin Rentals — no orders | "1 of 1 orders" + empty rows | proper EmptyState |
| Audit log — no entries | "Status and activity events..." copy with empty body | proper EmptyState |
| Sparkline panels (Today earnings / Active quotes when 0) | mini-line at 0 | hide line, show value `$0` muted |

---

## 1.12 Pinned banners / toasts

The "**3 Issues**" red pill in the bottom-left of every screenshot is the
**Next.js dev indicator** (the in-app dev tools bubble that surfaces
React/TS/build issues during `next dev`). It is not produced by anything in
`src/`. It will not appear in production. This is documented for clarity but
is **out of scope** for this PR.

The pinned bottom-left "Ops intelligence" panel inside the sidebar
(`Sidebar.tsx:268`) is in scope and is fine. No changes required.

Toasts: `src/design-system/admin/primitives/Toast` does not exist; toasts are
rendered via Sonner (`@/components/ui/sonner`) configured in
`src/app/admin/components/AdminShellV3Wrapper.tsx`. Audit: toasts use
default Sonner styling with admin-token colors. No drift.

---

## Summary of Phase 2 commits this audit drives

The findings above map 1:1 to the Phase 2 plan:

1. `feat(tokens): canonical design tokens — 5 type sizes, 4 text colors, 5 semantic colors` — §1.1, §1.2
2. `refactor(admin): retire gold accent — every instance replaced per semantic rules` — §1.2.2, §1.2.7
3. `refactor(admin): unified Button primitive applied across all admin pages` — §1.3
4. `feat(admin): unified StatCard — applied to 10+ surfaces` — §1.4
5. `feat(admin): unified StatusPill with strict semantic tone system` — §1.5
6. `feat(admin): unified PageHeader — retire inconsistent serif on operational pages` — §1.1.2, §1.8
7. `refactor(admin): kill every dash — proper empty state handling` — §1.11
8. `refactor(admin): chart color discipline — retire gold, retire arbitrary color pairs` — §1.9
9. `refactor(admin): unified table visual treatment across 8+ list pages` — §1.6
10. `refactor(sidebar): active state discipline + icon normalization + issues banner tone` — §1.10
11. `refactor(admin): unified form field visual language` — §1.7
12. `refactor(admin): page structure normalization with PageHeader + descriptions` — §1.8
13. `refactor(command-center): chart color discipline, status semantics, empty states, activity icons` — §1.9 + §1.11

Plus a critical bugfix:

- `fix(admin): platform page RSC crash — phosphor icons barrel marked client` —
  the platform settings page was hitting a runtime `createContext only works
  in Client Components` error. Fixed by marking
  `src/design-system/admin/icons.ts` and `src/design-system/admin/layout/nav.ts`
  as `"use client"` so RSC pages can transitively import the layout barrel.
