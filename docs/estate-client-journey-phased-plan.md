# Estate client journey — phased implementation plan

This document breaks the full “Estate touchpoint chain” into **ordered phases** that **add** to the current premium system (cream shells, forest CTAs, wine accents, shared footers, Mapbox) without replacing it wholesale.

**North star:** Estate stays visually and verbally distinct; Essential/Signature stay on light shells with wine headings — not full wine backgrounds.

---

## Phase 0 — Guardrails and inventory (1–2 days)

**Goal:** Lock boundaries before building so Estate does not dilute other tiers.

| Task | Output |
|------|--------|
| Document “Estate-only” vs “shared premium” | Short internal list: full wine **page** background = Estate client surfaces only; cream + wine type = quote/finalize/most email; forest = primary CTA everywhere unless an explicit exception is approved. |
| Align with existing rules | `.cursor/rules/global-button-system.mdc`, `mapbox-not-google.mdc`, `no-emojis-in-ui.mdc`, `email-footer-below-fold.mdc`. |
| Map current send points | `post-payment.ts` → `estateConfirmationEmail`; `tracking-notifications.ts` / crons / status pipeline for move-day emails. |
| Token patterns | Reuse `signTrackToken` / HMAC-style patterns already used for `/track/move/[id]?token=` for any new `welcome_package_token`. |

**Exit criteria:** Team agrees Estate welcome + optional Estate-only dark track are in scope; rose-filled email CTAs are **out** unless design explicitly overrides global button rule.

---

## Phase 1 — Estate confirmation email (additive tweaks) (2–4 days)

**Goal:** Richer **content hierarchy** without replacing `estateLuxuryCreamLayout` or `estateConfirmationEmail` structure.

| # | Task | Notes |
|---|------|--------|
| 1.1 | **Hero summary band** | Optional two-column strip above the bordered move table: move date \| “Estate” (or plan label), same card, Instrument Serif + DM Sans. |
| 1.2 | **Opening copy variant** | Optional line in “reserved / in our hands” tone; keep escape/brand voice review. |
| 1.3 | **Numbered “What happens next”** | Estate-only variant: 1–4 with wine or forest numerals (no emoji), or keep diamonds — pick one system per email. |
| 1.4 | **Coordinator block** | Single tight line: single point of contact, channels, horizon (e.g. through 30-day concierge), if not already implied. |
| 1.5 | **Welcome package placeholder** | If Phase 2 not ready: optional muted line “Your welcome guide will arrive in a follow-up” OR hide CTA until URL exists. |

**Files (existing):** `src/lib/email-templates.ts` (`estateConfirmationEmail`, `estateLuxuryCreamLayout`, `estateLabel`, …).

**Exit criteria:** No regression on footers, map links (wine), or `color-scheme: light` behavior; samples still render in admin style-sender if applicable.

---

## Phase 2 — Welcome package token + data model (2–3 days)

**Goal:** Secure, shareable URL for the welcome experience.

| # | Task | Notes |
|---|------|--------|
| 2.1 | **Migration** | `welcome_package_token TEXT UNIQUE` on `moves` (or `quotes` if you attach to quote — **decide one source of truth**). |
| 2.2 | **Generate token** | On Estate booking confirmed (same path as confirmation email in `post-payment` or equivalent). Cryptographically random, URL-safe. |
| 2.3 | **Persist** | Write token in same transaction / immediately after move creation as confirmation send. |
| 2.4 | **Build URL** | `getEmailBaseUrl() + /estate/welcome/` + token; pass into `TierConfirmationParams` / template data. |
| 2.5 | **Email CTA** | Add forest outlined CTA + optional wine text link (matches current Estate confirmation patterns), label e.g. “VIEW WELCOME GUIDE”. |

**Files:** new `supabase/migrations/…_welcome_package_token.sql`; `src/lib/automations/post-payment.ts`; types for `TierConfirmationParams` in `email-templates.ts` (or shared types file).

**Exit criteria:** Estate confirmations for new bookings include a working URL; invalid token returns 404; token not guessable.

---

## Phase 3 — Welcome package page `/estate/welcome/[token]` (1–2 weeks)

**Goal:** Story-driven, fast, mobile-first; **minimal JS** (static HTML from server components is fine).

| # | Task | Notes |
|---|------|--------|
| 3.1 | **Route** | `src/app/estate/welcome/[token]/page.tsx` (+ `layout.tsx` if needed). |
| 3.2 | **Auth** | Server: resolve token → move; 404 if missing/expired/cancelled; optional “move completed still viewable” policy. |
| 3.3 | **Data** | Load coordinator, dates, addresses, tier verify `estate` only (or allow premier legacy → map to estate if product says so). |
| 3.4 | **Sections** | Hero → Coordinator → Before move (timeline) → Pack day → Move day → New home → Protection → After move → FAQ → Footer CTA (track when available). |
| 3.5 | **FAQ** | Accordion with client component **only** for FAQ; rest static for perceived performance, or full static anchors. |
| 3.6 | **SEO / metadata** | `noindex`, `title` per move code or generic “Your Estate welcome guide”. |
| 3.7 | **Accessibility** | Heading order, focus states, no raw DB strings in UI (label maps). |

**Design:** Wine hero section allowed **on web** (Estate-only); inner sections can alternate wine bands and light bands — keep **2–3 colors per section** (Part 5 principles).

**Exit criteria:** Lighthouse reasonable on mobile; legal/support links; no PII in URL beyond token.

---

## Phase 4 — Estate-themed live tracking (1–2 weeks)

**Goal:** When `tier === 'estate'`, track UI feels like Estate; everyone else unchanged.

| # | Task | Notes |
|---|------|--------|
| 4.1 | **Theme flag** | `isEstate` from move/quote tier in `TrackMoveClient` (or server-passed prop). |
| 4.2 | **Shell** | Wine background `#2B0416` or token from `client-theme` / `STYLING_COLORS`; cream/off-white body text `#F9EDE4` where specified. |
| 4.3 | **Wordmark** | Cream/wine logo asset on dark (existing `YugoLogo` variant or estate track variant). |
| 4.4 | **Copy** | Headline e.g. “Your Estate move” for estate only; do not change non-estate strings. |
| 4.5 | **Mapbox** | Dark or custom style with wine-tinted accents — **Mapbox only**; adjust `TrackLiveMapMapbox.tsx` for estate branch. |
| 4.6 | **Timeline / cards** | Reuse patterns from `LiveMoveTimeline` with estate color tokens (no emoji). |
| 4.7 | **Coordinator strip** | Persistent block: name, phone, email (styled links, wine/cream contrast). |

**Files:** `src/app/track/move/[id]/TrackMoveClient.tsx`, `TrackLiveMapMapbox.tsx`, `LiveMoveTimeline.tsx`, possibly `src/lib/client-theme.ts`.

**Exit criteria:** WCAG contrast on wine surfaces; estate and non-estate both tested; map still works with `MAPBOX_TOKEN`.

---

## Phase 5 — Estate lifecycle emails (pre-move → move day) (2–3 weeks)

**Goal:** Tier-routed templates that **reuse** layout primitives (new `estateDarkEmailLayout` **or** extend cream estate — **decision**: dark wine email is spec-heavy but fights current cream confirmation; recommend **cream ivory card + wine accents** for parity with Phase 1 unless product insists on dark email).

| Template (concept) | Trigger | Subject idea |
|--------------------|---------|----------------|
| Pre-move (T-2 or T-48) | Cron / status | “Your Estate move is in two days” |
| Pack day morning | Job scheduled / crew dispatch | “Pack day has begun” |
| Crew en route | Existing tracking ping | “Your crew is on the way” (Estate skin) |
| Move underway | Status change | “Your move is underway” |

| # | Task | Notes |
|---|------|--------|
| 5.1 | **Template registry** | Add `send.ts` template names + HTML builders in `email-templates.ts` or `src/lib/email/estate-lifecycle-templates.ts`. |
| 5.2 | **Routing** | In `tracking-notifications.ts` (and any cron), if `tier === 'estate'` use Estate HTML; else existing `statusUpdateEmailHtml` / lifecycle. |
| 5.3 | **Shared blocks** | Coordinator row, tracker CTA, footer spacer, wine map links. |
| 5.4 | **Plaintext** | Matching text bodies for Resend. |
| 5.5 | **Samples** | `style-sample-jobs.ts` entries for QA. |

**Exit criteria:** No duplicate sends; idempotency keys where needed; all client-visible strings label-mapped.

---

## Phase 6 — Post-move + 30-day check-in (Estate) (1 week)

| # | Task | Notes |
|---|------|--------|
| 6.1 | **Move complete** | “Welcome home” tone; concierge start; subtle review CTA (forest outlined). |
| 6.2 | **30-day check-in** | Cron keyed off `completed_at` + 30 days; Estate template; referral if product has code. |
| 6.3 | **Suppression** | Respect low-satisfaction / unsubscribe / HubSpot rules if integrated. |

**Files:** likely `src/lib/automations/*`, new cron route, `email-templates` or estate module.

---

## Phase 7 — “Premium light” elsewhere (ongoing / optional)

**Goal:** Apply **principles** from Part 5 without copying Estate chrome.

| Surface | Apply | Do not apply |
|---------|--------|----------------|
| Essential/Signature emails | Uppercase labels, spacing, wine headings, forest CTAs | Full wine body |
| Partner portal | Label/value hierarchy, breathing room | Wine page background |
| White glove / specialty web | Off-white panels, wine headings | Estate-only copy (“concierge” overload) |
| Admin | Sidebar tokens, dense tables | Serif headlines that slow scanning |

---

## Phase 8 — QA, observability, rollout (parallel / end of each phase)

| Task | Notes |
|------|--------|
| Visual QA | iOS Mail, Gmail web/mobile, Outlook.com; dark-mode quirks (`color-scheme`). |
| Copy/legal | Insurance numbers, HST, coordinator disclaimers. |
| Logging | Template name + tier in webhook logs for failures. |
| Feature flag | Optional `estate_welcome_v1` to gate welcome page + new emails. |
| Rollout | Enable token generation first; then page; then email CTA; then track theme; then lifecycle. |

---

## Dependency graph (summary)

```
Phase 0 (guardrails)
    ↓
Phase 1 (confirmation polish) ──→ can ship independently
    ↓
Phase 2 (token + URL) ──────────→ required before Phase 3 email CTA works
    ↓
Phase 3 (welcome page)
    ↓
Phase 4 (track theme) ──────────→ can parallel Phase 3 after Phase 0
    ↓
Phase 5 (lifecycle emails) ─────→ can start after Phase 2 for data; content can reference welcome URL
    ↓
Phase 6 (post-move / 30-day) ──→ needs completed move timestamps + cron
    ↓
Phase 7 (principles elsewhere) → continuous
    ↓
Phase 8 (QA) ───────────────────→ continuous per phase
```

---

## Explicit non-goals (protect what you built)

- Replacing `estateConfirmationEmail` with a full `#2B0416` email body as the **default** Estate confirmation (unless product + a11y sign off).
- Rose/gold **filled** primary CTAs in email (forest outlined + chevron system stays default).
- Google Maps anywhere.
- Emoji in product UI or these emails.
- Copying Estate **dark shell** to Signature/Essential client emails.

---

## Quick reference — key files today

| Area | Location |
|------|----------|
| Estate confirmation | `src/lib/email-templates.ts` (`estateConfirmationEmail`, `estateLuxuryCreamLayout`) |
| Booking send | `src/lib/automations/post-payment.ts` |
| Status / track emails | `src/lib/tracking-notifications.ts`, `statusUpdateEmailHtml` in `email-templates.ts` |
| Track UI | `src/app/track/move/[id]/TrackMoveClient.tsx`, `TrackLiveMapMapbox.tsx` |
| Footer spacer rule | `src/lib/email/client-email-footer.ts`, `.cursor/rules/email-footer-below-fold.mdc` |
| Map links + colors | `src/lib/email/email-link-utils.ts` (`emailMapLinkHtml`) |

---

*Last updated: generated as a living roadmap; adjust dates and owners in your project tracker.*
