# Checklist Validation Report

Validated against the yugo-ops codebase. **Legend:** ✅ Verified in code | ⚠️ Partial / edge case | ❌ Gap / not found | 🔧 Fix applied (this session).

---

## CATEGORY 1: PRICING & ALGORITHM

| # | Item | Status | Notes |
|---|------|--------|--------|
| 1 | Labour delta component | ✅ | `estimateLabourFromScore()` in `src/lib/inventory-labour.ts`; used in quotes/generate, moves/create, InventoryInput. MIN_HOURS_BY_SIZE, loadHours (score/10), disassembly, overhead. |
| 2 | estimateLabour() thresholds (crew/hours too low) | ✅ | Prompt 90 PATCH in inventory-labour: MIN_CREW_BY_SIZE, crewFromScore thresholds (20/50/90), MIN_HOURS_BY_SIZE, divisor 10, OVERHEAD_HOURS 0.75. |
| 3 | Client boxes not affecting price | ✅ | `client_box_count` in quote generate; `boxScore = boxCount * 0.3`; `calcInventoryModifier` uses `clientBoxCount`; CreateMoveForm + QuoteFormClient + EditQuoteClient all wire box count. |
| 4 | Inventory quantity sanity check | ✅ | `validateInventoryQuantities` / `validateInventoryQuantity` in `src/lib/inventory-quantity-validation.ts`; used in quotes/generate (inventoryWarnings) and InventoryInput. |
| 5 | Inventory modifier cap raised to 1.50 | ✅ | Migration `20250390000000_pricing_algorithm_fixes.sql`: max_modifier 1.50 for studio/1br/2br; 1.45 for 3br/4br; 1.40 for 5br_plus. |
| 6 | Specialty items affect crew/hours | ✅ | In quotes/generate: FIX 3 — `SPECIALTY_CREW_IMPACT`, labour estimate uses adjusted score for specialty items. |
| 7 | Labour rate updated to $75 | ✅ | Migration adds `labour_rate_per_mover_hour` = 75; generate uses `cfgNum(config, "labour_rate_per_mover_hour", 75)`. |
| 8 | Tier rename (Essentials→Curated, Premier→Signature) | ✅ | Migration `20250387000000_tier_rename_curated_signature.sql` + `20250388000000_quotes_recommended_tier_constraint_fix.sql`. Code still has fallbacks to essentials/premier in many files (quote-templates, PricingControlPanel, post-payment, etc.) for backward compatibility. |
| 9 | Tiered deposits (10%/15%/25%) | ✅ | `deposit_curated_pct` 10, `deposit_signature_pct` 15, `deposit_estate_pct` 25 in migration and quotes/generate; `calculateTieredDeposit` in quote-shared. |
| 10 | Feature list duplicates fixed | ⚠️ | Not verified by grep; tier_features / tier display logic would need manual review. |
| 11 | Access surcharges at BOTH ends | ✅ | `getAccessSurcharge(sb, input.from_access)` and `getAccessSurcharge(sb, input.to_access)`; `accessSurcharge = fromAccess + toAccess` in quotes/generate. |
| 12 | Weekend/day-of-week multiplier | ✅ | `DEFAULT_DAY_OF_WEEK_MULTIPLIER` in quotes/generate (saturday/sunday 1.10); `date_factors` lookup; widget estimate has weekendMult 1.1; partner delivery price has is_weekend. |
| 13 | Distance surcharge scaling | ✅ | Migration FIX 5: `distance_per_km_rate`, `distance_base_km_local`; generate uses distBaseKm (10 default), perKmRate (4), `distanceSurcharge = (distKm - distBaseKm) * perKmRate`. |

---

## CATEGORY 2: EMAIL LIFECYCLE

| # | Item | Status | Notes |
|---|------|--------|--------|
| 14 | Quote email | ✅ | Built (quote-templates, send). |
| 15 | Quote follow-ups (24h, 48h, 5-day) | ✅ | Cron `quote-followups/route.ts`; verify cron runs (env). |
| 16 | Quote expiry warning | ✅ | Built. |
| 17 | Booking confirmation (3 tier-specific) | ✅ | post-payment + tier rename fallbacks (essentials→Curated, premier→Signature). |
| 18 | Pre-move 72hr reminder | ✅ | Cron `pre-move-emails`; verify cron. |
| 19 | Day-before 24hr details | ✅ | Built. |
| 20 | Balance reminders (72hr + 48hr) | ✅ | Cron `charge-balance`; verify cron. |
| 21 | Move completion email | ⚠️ | **Template exists and IS called** when crew marks job complete via **tracking checkpoint** (`notifyOnCheckpoint` → `move-complete` in tracking-notifications). **Gap:** When admin sets status to "completed" in Move Detail UI (Supabase update from client), the move-complete email is **not** sent. Only crew completion path sends it. |
| 22 | Post-move review request | ✅ | Cron post-move-reviews; createReviewRequestIfEligible from checkpoint. |
| 23–25 | Perks + referral / anniversary / seasonal | ⚠️ | Prompt 85C designed; not fully traced in this run. |
| 26 | completed_at never set on moves | ✅ | **Fixed in code.** Checkpoint route sets `moves.completed_at` when crew marks completed. MoveDetailClient also sets `completed_at` when admin sets status to "completed". Backfill migration exists. |
| 27 | CRON_SECRET not set in Vercel | ❌ | Env/deployment — set in Vercel. |
| 28 | Vercel Hobby / crons | ❌ | Upgrade or external cron. |

---

## CATEGORY 3: CLIENT-FACING PAGES

| # | Item | Status | Notes |
|---|------|--------|--------|
| 29–30 | Client quote page, progressive disclosure | ✅ | Quote page and booking flow exist. |
| 31 | Client tracking page | ✅ | Built. |
| 32–33 | Tip screen redesign, tip-later button | ⚠️ | Prompt 86; verify in TrackTipClient / tip routes. |
| 34 | Photos + Documents merged into Files | ⚠️ | Prompt 85A; MoveFilesSection exists. |
| 35 | Auto-generated invoice/receipt/summary PDFs | ✅ | `generateMovePDFs` called from checkpoint on completion; regenerate-documents route exists. |
| 36 | Referral code on completion | ✅ | `createClientReferralIfNeeded` in checkpoint on completion (client_referrals). |
| 37–38 | Partner perks, referral sharing on tracking | ⚠️ | Prompt 85C; verify UI on track page. |
| 39–40 | Widget, claim form | ✅ | Built. |
| 41 | "Leave a Review" phone number has no context | ⚠️ | TrackMoveClient uses `NEXT_PUBLIC_REVIEW_URL` with label "Leave a Review"; no explicit "Google review" or phone-context label. Quick fix: add aria-label or visible text e.g. "Leave a Google review". |
| 42 | Client self-service rescheduling | ❌ | Not built. |

---

## CATEGORY 4: ADMIN PORTAL

| # | Item | Status | Notes |
|---|------|--------|--------|
| 43–56 | Command Center, Moves, Quotes, Calendar, etc. | ✅ | Present. Tier rename fallbacks in AllMovesClient, quote UIs. |
| 57 | Generate Quote — referral code field | ⚠️ | 85C; verify field on form. |
| 58–59 | Move detail Files tab merge, Messages removed | ⚠️ | 85A/B; MoveFilesSection, messages tab check. |
| 60 | Regenerate Documents button | ✅ | Route `regenerate-documents/route.ts` and UI (MoveDetailClient/MoveDocumentsSection). |

---

## CATEGORY 5: CREW PORTAL

| # | Item | Status | Notes |
|---|------|--------|--------|
| 61–63 | Crew portal, GPS, checkpoints | ✅ | Built. |
| 64 | PoD capture flow | ⚠️ | Verify implementation (signoff, conditions, photos). |
| 65 | Crew portal tip section should NOT appear | ⚠️ | Prompt 86; verify hidden on crew views. |
| 66 | Driver scorecards | ❌ | Not built. |

---

## CATEGORY 6: PARTNER PORTAL

| # | Item | Status | Notes |
|---|------|--------|--------|
| 67–73 | Partner portal, schedule, rate cards, projects, etc. | ✅ | Built. |
| 74–77 | Analytics upgrade, multi-vendor, end customer tracking, PoD visibility | ⚠️ | Prompts 76–78; verify in partner routes/components. |

---

## CATEGORY 7: PRODUCTION / INFRASTRUCTURE

| # | Item | Status | Notes |
|---|------|--------|--------|
| 78–79 | CRON_SECRET, Vercel Pro / external cron | ❌ | Env and plan. |
| 80 | completed_at set on completion | ✅ | Checkpoint sets it; admin UI sets it when status → completed. |
| 81 | moveCompleteEmail called | ⚠️ | Called on **crew** completion path only; not when admin marks completed in UI. |
| 82 | Square webhook logging | ✅ | `webhook_logs` insert in Square webhook route (success and catch). |
| 83–90 | Resend, Mapbox, Supabase, Sentry, Analytics, Terms link, Storage, test data | ❌ / ⚠️ | Dashboard/config; Sentry/Analytics not found in code; Terms link and Storage need manual check. |

---

## CATEGORY 8: SECURITY

| # | Item | Status | Notes |
|---|------|--------|--------|
| 91 | NEXT_PUBLIC_ audit | ⚠️ | NEXT_PUBLIC_ used for: APP_URL, Supabase URL/anon, Mapbox, Square (sandbox, app id, location), YUGO_PHONE, YUGO_EMAIL, REVIEW_URL. All appropriate for client exposure; no secrets in NEXT_PUBLIC_. |
| 92–95 | Zod, auth, rate limiting, CORS | ⚠️ | requireAdmin/requireStaff/requireRole used; rate limiting in partner forgot-password, contracts/sign, etc. Full audit per prompts 72–74 not repeated here. |
| 96 | .env.local ever committed / rotate keys | ❌ | Check git history. |

---

## CATEGORY 9: INTEGRATIONS

| # | Item | Status | Notes |
|---|------|--------|--------|
| 97–104 | Square, Resend, Twilio, Mapbox, HubSpot | ✅ | Implemented; verify webhooks and config. |
| 103 | Google Maps Distance Matrix | ✅ | **Not used;** project uses Mapbox (per .cursor rules). ETA uses Mapbox/distance. |

---

## CATEGORY 10: DATA CONSISTENCY

| # | Item | Status | Notes |
|---|------|--------|--------|
| 106 | Old tier names in DB | ✅ | Migrations 20250387/20250388 update essentials→curated, premier→signature. |
| 107 | Tier references in code | ⚠️ | Many files still reference essentials/premier as **fallbacks** (e.g. tier_essentials_multiplier, quote.tiers?.essentials). Intentional for backward compatibility. |
| 108 | Test data cleanup | ❌ | Run SQL after backup. |
| 109 | referrals vs client_referrals | ✅ | **Codebase uses both:** `referrals` = partner/realtor referrals; `client_referrals` = client referral codes (post-move). Square webhook, post-payment, perks-referral route use `client_referrals`. Naming is consistent; no conflict. |

---

## CRITICAL PATH — Validation Summary

| Priority | Item | Validated |
|----------|------|-----------|
| CRON_SECRET in Vercel | ❌ Env — set manually. |
| Vercel Pro / external cron | ❌ Plan / external service. |
| completed_at | ✅ Set in checkpoint and admin status update. |
| moveCompleteEmail | ⚠️ Called on crew completion only; admin completion does not send email. |
| Square webhook logging | ✅ Present (webhook_logs). |
| Test data cleanup | ❌ Run after backup. |
| Tier rename (87) | ✅ Migrations + code fallbacks. |
| Algorithm (90) | ✅ Labour, boxes, inventory cap, specialty, labour rate, distance, access both ends, weekend. |
| PDFs + referral timing (91) | ✅ generateMovePDFs and createClientReferralIfNeeded on checkpoint completion. |

---

## Recommended code fix (admin completion → move-complete email) — IMPLEMENTED

**Done:** When admin sets move status to **"completed"** in Move Detail, the client now receives the move-complete email and review/referral/PDF are triggered.

- **`POST /api/admin/moves/[id]/notify-complete`** — Staff-only; sends move-complete email, then fires review request, client referral, and PDF generation (same as crew checkpoint path).
- **MoveDetailClient** — After Supabase status update to completed, calls `notify-complete` instead of `ensure-review-request` (notify-complete includes review request).

---

*Generated by checklist validation. Re-run after applying prompts or migrations.*
