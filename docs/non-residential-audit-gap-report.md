# OPS+ Non-Residential System Audit — Gap Report
Generated: 2026-07-01
Auditor: Claude Code
Baseline: Residential move system (`local_move` + Essential/Signature/Estate tiers) — treated as complete.

---

## EXECUTIVE SUMMARY

Non-residential is far more built-out than a greenfield audit would expect: nearly every service type has a dedicated quote layout, the crew flow engine genuinely branches per archetype, HubSpot/Square are service-type-aware via central mapping tables, and all 11 B2B verticals have seeded rate rows + working dimensional pricing. This is not "residential with stubs." The failures are **specific, silent fall-throughs**, not missing modules.

Three findings are release-blocking. **(1) `b2b_outbound_stage` is broken end-to-end**: it is selectable and quotable but on booking it is NOT routed to the delivery creator, so it creates a mislabeled *residential* move with no warehouse/palletize/carrier scope, no track experience, no crew flow, no HubSpot deal, and no SMS. **(2) The Edit-Quote "regenerate" button is ungated** for `event`, `bin_rental`, and `b2b_outbound_stage`, and the B2B guard only matches the exact slug `b2b_delivery` (missing `b2b_oneoff`/`b2b_outbound_stage`) — so re-pricing runs these through the residential engine and destroys their scope. **(3) `event` scope is destroyed on edit-regenerate** and its booking confirmation email/SMS + client track page all fall back to residential "your move" framing.

The next tier of gaps is a consistent pattern: **`white_glove`, `specialty`, `event`, `labour_only` share a residential Signature confirmation email** ("Your move is confirmed", truck, From→To) because they carry `tier_selected = null` and hit the `?? signatureConfirmationEmail` catch-all; **`b2b_delivery` sends no client booking confirmation at all** (email or SMS); **office_move's client timeline renders empty during the Day-1 pack phase** and the **crew app never sees office Day-1 pack/IT stages**; and the **manual Create-Move admin route silently drops office/single_item/specialty scope fields** it collects in the form.

Highest-priority fixes: route `b2b_outbound_stage` correctly (or block it), gate the edit-regenerate path by service type, ship dedicated confirmation email/SMS for event + white_glove + specialty + labour_only + b2b_delivery, and reconcile the office crew flow with the office track flow.

---

## COMPLETION MATRIX (vs residential baseline)

| Service type | Quote (A/B/C/F) | Book→Move (D/E) | Client Track (G/H) | Crew (I/J) | Email (L) | SMS (M) | HubSpot (N) | Square (O) | Overall |
|---|---|---|---|---|---|---|---|---|---|
| long_distance | 90% | 85% | 60% | 100% | 95% | 60% | 100% | 100% | **~85%** |
| office_move | 90% | 75% | 65% | 55% | 75% | 65% | 100% | 100% | **~78%** |
| single_item | 85% | 70% | 70% | 100% | 85% | 55% | 100% | 100% | **~83%** |
| white_glove | 95% | 90% | 75% | 100% | 40% | 55% | 100% | 100% | **~82%** |
| specialty | 80% | 70% | 55% | 40% | 40% | 45% | 100% | 100% | **~66%** |
| event | 80% | 70% | 30% | 80% | 40% | 40% | 100% | 100% | **~65%** |
| b2b_delivery | 95% | 100% | 70% | 100% | 60% | 55% | 100% | 100% | **~85%** |
| b2b_outbound_stage | 30% | 5% | 5% | 20% | 90% | 30% | 0% | 100% | **~35%** |
| labour_only | 90% | 90% | 40% | 100% | 40% | 50% | 90%¹ | 100% | **~75%** |
| bin_rental | 90% | 90% | 90% | 100% | 70% | 90% | 90%¹ | 100% | **~90%** |

¹ HubSpot service_type enum falls to "Other" (deal creates, but pipeline reporting can't distinguish).

---

## SERVICE TYPE GAPS

### long_distance — ~85%
| Surface | Status | Gap | Severity |
|---|---|---|---|
| A Generate quote | ✅ Complete | Full form path; distance/Mapbox wired | — |
| B Quote detail | ✅ Complete | Shares residential rendering | — |
| C Edit quote | ✅ Complete | `buildPayload` handles it (EditQuoteClient.tsx:1128) | — |
| F Client quote | ⚠️ Partial | `LongDistanceLayout` hardcodes `DEFAULT_INCLUDES` with fabricated "$5M cargo insurance / 3-person crew / climate-controlled truck" when `factors.includes` absent (`LongDistanceLayout.tsx:13-21`); receives raw `quote` not `quoteForDisplay` (QuotePageClient.tsx:2197); dead `ldTruckSur=0`/`ldTruckLine=null` (`:37-38`); hardcoded transit `distance/400` and "25% deposit" copy (`:207`) can drift from `calculateDeposit` | High |
| D Manual create | ⚠️ Partial | Manual form maps "Residential" only to `local_move`; cannot manually create a long-distance move (route.ts:31) | Medium |
| G Client track | ⚠️ Partial | No LD branch in `TrackMoveClient`; same-city copy "Crew en route to your home"/"Arrived at new home" (`LiveMoveTimeline.tsx:22,33`); no in-transit/multi-day-transit concept | Medium |
| L Email | ✅ Complete | Tiered → correct residential templates | Low |
| M SMS | ⚠️ Partial | 24hr "Your Yugo move is tomorrow… crew arriving" is wrong framing for inter-city (quote-sms.ts:224-245, service-type-blind) | Medium |

**Critical:** none.

### office_move — ~78%
| Surface | Status | Gap | Severity |
|---|---|---|---|
| A Generate quote | ✅ Complete | Full office fields (sqft, workstations, IT, phasing) + scope tiers | — |
| B Quote detail | ✅ Complete | Multi-truck prefix + multi-day range (QuoteDetailClient.tsx:2428) | Low |
| C Edit quote | ✅ Complete | office branch incl. inventory reconstruction (EditQuoteClient.tsx:1024-1070) | — |
| F Client quote | ✅ Complete | Tiered path mirrors baseline; legacy non-tiered fallback hardcodes deposit-pct string (`OfficeLayout.tsx:806`) & `crew??4`/`trucks??1` (`:699,708`) | Low |
| D Manual create | ⚠️ Partial | Form collects office fields but `/api/admin/moves/create/route.ts` writes **no office column or factors_applied** — silently dropped; manual multi-day is residential-only (route.ts:736) | High |
| E Move detail | ✅ Complete | Tiered + multi-day panel if `move_project_id` set | — |
| G Client track | ⚠️ Partial | `OfficeTrackHero` Day1/Day2 is good, but **Live timeline breaks during pack day**: `timeline/route.ts:12-23 MOVE_STATUS_ORDER` omits `initial_walkthrough`/`it_documentation`/`packing_*`/`setup` → `currentStatusIdx=-1` → empty timeline; inventory groups by "room"/"N rooms" (residential framing for workstations) | High |
| I/J Crew | ⚠️ Partial | Crew gets 6-step `OFFICE_MOVE_FLOW` (service-type-flow.ts:127,180); the 12-step Day1/Day2 `OFFICE_MOVE_STATUS_FLOW` with walkthrough/IT-doc/packing (crew-tracking-status.ts:111) is used **only** by the client `OfficeTrackHero`, never by crew → crew has no pack-day/IT stages | High |
| L Email | ⚠️ Partial | `officeConfirmationEmail` fires **only** when `quote.selected_tier==="priority"` (post-payment.ts:590); any other/null tier silently ships residential **Signature** copy. Pre-move 72h/24h office variants exist ✅ | Medium |
| M SMS | ⚠️ Partial | Confirmation has office-Priority variant (post-payment.ts:831) but day-of client SMS `client-tracking-sms.ts:18` has no office branch → generic move copy ("your new home") | Medium |

**Critical:** none. **High cluster:** manual-create data loss, empty pack-day timeline, crew missing Day-1 stages.

### single_item — ~83%
| Surface | Status | Gap | Severity |
|---|---|---|---|
| A Generate quote | ✅ Complete | Dedicated item fields (desc/category/dims/weight/photo) | — |
| B Quote detail | ⚠️ Partial | Generic scope block only; no item desc/category/weight/assembly shown | Medium |
| C Edit quote | ✅ Complete | single_item branch (EditQuoteClient.tsx:1072) | — |
| F Client quote | ✅ Complete | Per-line resolution, residential/commercial copy, booking-window full-pay; minor dead `truckBreakdown=null` (`SingleItemLayout.tsx:98`) | Low |
| D Manual create | ⚠️ Partial | Form sends item_* fields but route writes none (only white_glove branch persists item cols) — lost unless created from a quote | High |
| E Move detail | ⚠️ Partial | `SingleItemTaskBlock` renders only if `factors_applied.single_item_lines` present (MoveDetailClient.tsx:4518); manual single-item moves show nothing item-specific | Medium |
| G Client track | ⚠️ Partial | Has delivery branches (label, inventory hidden) but rides the residential `moves` shell; "Need to update your move?" block still reachable via `!isEstateTier` (TrackMoveClient.tsx:4336) | Medium |
| L Email | ✅/⚠️ | Dedicated `singleItemConfirmationEmail` ✅; excluded from pre-move sequence by `isFullRelocationMove` (arguably correct); post-move perks/anniversary residential-framed | Medium |
| M SMS | ⚠️ Partial | 72hr reminder skipped (checklist-gated), 24hr still fires generic "move"/"crew" copy → inconsistent cadence | Medium |

### white_glove — ~82%
| Surface | Status | Gap | Severity |
|---|---|---|---|
| A/B/C/F Quote | ✅ Complete | Best-covered non-residential quote UX: item table, declared value, insurance chips, building/delivery notes, empty-state instead of fake defaults (`WhiteGloveLayout.tsx`) | — |
| D/E Move | ✅ Complete / ⚠️ | Manual create fully handled (route.ts:281-300) — best-supported manual path; detail is generic room-inventory, no per-item placement/assembly | Low |
| G Client track | ⚠️ Partial | Kind-aware copy but timeline uses generic delivery copy not WG labels; `isClientLogisticsDeliveryServiceType` lists WG as delivery yet payments route WG to `moves` → copy inconsistency | Medium |
| I/J Crew | ✅ Complete | Kind-aware: delivery (6-step) vs in-home (4-step, no transit) via `whiteGloveKind`/`sameAddress` (service-type-flow.ts:196) | — |
| **L Email** | ❌ **Missing/Wrong** | Falls to residential **Signature** confirmation ("Your move is confirmed", "Plan: Signature", truck, From→To) — no WG template; tier=null → `?? signatureConfirmationEmail` (post-payment.ts:610); day-of checkpoint copy also generic move | **High** |
| M SMS | ⚠️ Partial | Generic move copy unless Estate tier; relies on tier not service_type | Med |

**Critical:** none. **High:** no dedicated confirmation email; day-of copy wrong for in-home service.

### specialty — ~66%
| Surface | Status | Gap | Severity |
|---|---|---|---|
| A Generate quote | ✅ Complete | Full specialty builder (type/dims/weight/requirements/building reqs) | — |
| B Quote detail | ⚠️ Partial | Generic block; no project_type/timeline/crating/climate shown | Medium |
| C Edit quote | ✅ Complete | specialty branch (EditQuoteClient.tsx:1120) | — |
| F Client quote | ⚠️ Partial | Hardcoded `DEFAULT_INCLUDES` incl. "$5M cargo insurance" when `f.includes` absent (`SpecialtyLayout.tsx:37-43`); requirement copy hardcoded not data-driven; computed `deposit` never displayed (`:35`, dead) | Medium |
| D Manual create | ⚠️ Partial | Form sends project_type/crating/climate/equipment/insurance but route writes none — dropped | High |
| I/J Crew | ❌ Missing | Not in `normalizeCrewServiceCategory` → falls to residential default (crew-service-category.ts:28): full loading/unloading flow + inventory walkthrough gate | Medium |
| G Client track | ⚠️ Partial | Only a label + one photo section; otherwise full residential shell (room inventory, residential timeline copy) | Medium |
| H Confirmed page | ⚠️ Defaulted | serviceVerb="move", "Move date", "Prepare your space" — wrong for single-piece specialty | Medium |
| **L Email** | ❌ **Missing/Wrong** | Residential Signature fallback | **High** |
| M SMS | ⚠️ Partial | No specialty copy anywhere | Medium |

Note: admin `/api/admin/quotes/specialty-transport` route creates a **`b2b_delivery`** quote (not `specialty`) — a separate specialty path worth reconciling.

### event — ~65%
| Surface | Status | Gap | Severity |
|---|---|---|---|
| A Generate quote | ✅ Complete | Multi-leg builder (delivery+return pairs, setup/teardown) | — |
| B Quote detail | ✅ Complete | Dedicated Event Details incl. multi-leg (QuoteDetailClient.tsx:2766-2849) | — |
| **C Edit quote** | ❌ **Missing** | No event branch in `buildPayload`, no scope UI; regenerate button (EditQuoteClient.tsx:3248, active) POSTs a move payload with no event_legs/hours/crew → re-prices as a plain move, **destroying event scope** | **Critical** |
| F Client quote | ✅ Complete | Single/multi-leg, per-leg scaling, uses `serverDeposit` first (`EventLayout.tsx:68`); computed deposit unused (full-pay CTA) | Low |
| D Manual create | ⚠️ Partial | Manual form makes a single move, not the delivery+return pair the quote path builds (CreateMoveForm.tsx:1969) | Medium |
| **G Client track** | ❌ **Missing** | **No event branch** in `TrackMoveClient`; real DB stages (`en_route_venue`/`arrived_venue`/`event_active`/`teardown`, tracking-status-types.ts:8) unknown to client timeline/stepper → render blank; room inventory framing wrong | High |
| H Confirmed page | ⚠️ Defaulted | serviceVerb="move", "Move date", "Prepare your space" | Medium |
| I/J Crew | ⚠️ Partial | 8-step round-trip `EVENT_MOVE_FLOW` is correct ✅, BUT inventory walkthrough gate still fires at `arrived_at_pickup` with residential "verify inventory" copy (page.tsx:1171) | Medium |
| **L Email** | ❌ **Missing/Wrong** | Residential Signature fallback ("your move is confirmed", truck) | **High** |
| M SMS | ❌ Missing | Quote SMS is event-aware, but confirmation + reminders + day-of all fall to generic "Your Yugo move is tomorrow… crew arriving"; `partner-job-comms.ts:98` has no event checkpoint cases | High |

**Critical:** edit-regenerate destroys scope. **High:** no client track, wrong confirmation email/SMS.

### b2b_delivery (b2b_oneoff) — ~85%
| Surface | Status | Gap | Severity |
|---|---|---|---|
| A/B/F Quote | ✅ Complete | Dedicated B2B one-off form + detail (business/delivery block) + `B2BOneOffLayout` (pro-forma invoice, Net-30, split pay); hidden from Step-1 picker but reachable via URL/prefill | — |
| **C Edit quote** | ❌ **Partial/broken** | `isB2bQuote = serviceType === "b2b_delivery"` (EditQuoteClient.tsx:346) only disables the header Save; the **bottom "Save changes & preview new pricing" button (`:3248`) is gated only on `generating`** → operator can regenerate through the move engine. Also matches only slug `b2b_delivery`, so a `b2b_oneoff` quote gets zero protection | **Critical** |
| D/E Move | ✅ Complete | Routes to `deliveries` table (not `moves`); managed at `/admin/deliveries/[id]` | — |
| G Client track | ⚠️ Partial | Separate `track/delivery` page; fixed 4-step stepper doesn't reflect current stop on multi-stop routes (TrackDeliveryClient.tsx:79); stale hardcoded `support@helloyugo.com` (`:316`) & phone (`:1308`) | High |
| **L Email** | ❌ Missing | `runPostPaymentActionsB2BDelivery` sends **no client booking confirmation** — only internal admin alert (post-payment.ts:1316); en-route/delivered POD emails exist ✅ | **High** |
| **M SMS** | ❌ Missing | No booking-confirmation SMS to recipient on the org B2B→delivery path; out-for-delivery/delivered SMS exist ✅ | **High** |

### b2b_outbound_stage — ~35% ⚠️ BROKEN END-TO-END
| Surface | Status | Gap | Severity |
|---|---|---|---|
| A Generate quote | ⚠️ Partial | In `QUOTE_SERVICE_TYPE_DEFINITIONS` (renders in Step-1 picker) but **zero field handling** in the 16k-line form — no scope UI (grep: 0 hits in `quotes/new/`) | High |
| B Quote detail | ❌ Missing | 0 hits in QuoteDetailClient; generic block, no scope | High |
| **C Edit quote** | ❌ Missing | No branch, not caught by `isB2bQuote`, generic form + **active regenerate** → invalid re-price | **Critical** |
| F Client quote | ❌ Missing | No layout; falls to generic `FallbackPrice` (QuotePageClient.tsx:2407) — bare price/confirm, no route/line-items/terms | High |
| **D Book→Move** | ❌ **Broken** | Excluded from `isB2BDeliveryQuoteServiceType` (b2b-quote-copy.ts:9) so NOT diverted to delivery creator → falls into `createMoveFromQuote` where `SERVICE_TO_MOVE_TYPE` has no entry → `move_type` defaults to **`"residential"`** (create-move-from-quote.ts:59-70,370). **Any outbound-staging booking produces a mislabeled residential move with no warehouse/palletize/carrier scope.** | **Critical** |
| G Client track | ❌ Missing | Lands on `track/move` as fully residential-defaulted (room inventory, "your home") | Critical |
| I/J Crew | ❌ Missing | No mapper entry → residential loading/unloading flow + inventory walkthrough | Medium |
| N HubSpot | ❌ Missing | No deal path for outbound shipments (only quotes/moves/deliveries create deals) | High |
| M SMS | ❌ Missing | Zero SMS (partner notifications email-only by design) | Medium |
| L Email | ✅ Complete | Outbound staging email suite exists (confirmation/picked_up/ready_for_carrier/handed_off) | Low |
| O Square | ✅ Complete | Square invoice on completion (outbound-staging/invoice.ts:66) | — |

**This is the single most broken service type.** Emails + Square invoice work, but the booking, move record, quote scope, track, crew, and HubSpot are all wrong or absent.

### labour_only — ~75%
| Surface | Status | Gap | Severity |
|---|---|---|---|
| A/C/F Quote | ✅ Complete | Category, two-visit schedule, storage note, 4-day full-pay rule, WSIB lines (`LabourOnlyLayout.tsx`) | — |
| B Quote detail | ⚠️ Partial | Generic block; no job category/complexity/visits/storage | Medium |
| D/E Move | ✅ Complete / ⚠️ | Manual + convert both work; but `DistanceLogistics` always renders on detail (MoveDetailClient.tsx:3074) showing irrelevant distance/drive-time for single-location work | Low |
| G Client track | ❌ Defaulted | No labour branch; residential timeline ("en route to your home"), room inventory, no same-address handling | High |
| H Confirmed page | ⚠️ Defaulted | serviceVerb="move", "Prepare your space" | Medium |
| I/J Crew | ✅ Complete | `LABOUR_ONLY_FLOW` no transit legs; walkthrough gate can't fire | — |
| **L Email** | ❌ Missing/Wrong | Residential Signature fallback (shows truck + From→To for a no-transit job) | **High** |
| M SMS | ⚠️ Partial | 72hr skipped, 24hr generic; checklist correctly suppressed | Medium |
| N HubSpot | ⚠️ Partial | service_type enum = "Other" (deal-properties-builder.ts:126) | Low |

### bin_rental — ~90%
| Surface | Status | Gap | Severity |
|---|---|---|---|
| A Generate quote | ✅ Complete | Bin flow; hidden from Step-1 picker, reached via `?service=bin_rental` | — |
| B Quote detail | ⚠️ Partial | Only negative handling (hides Create Move); no bin size/period/placement | High |
| **C Edit quote** | ❌ Missing | No scope branch; `buildPayload` still sends move_size (EditQuoteClient.tsx:996); generic form + **active regenerate** → invalid re-price | High |
| F Client quote | ✅ Complete | Purpose-built `BinRentalLayout` (bundle items, schedule, HST-incl, full-pay) | Low |
| D/E Move | ✅ Complete | Convert creates `bin_orders` row; detail redirects to `/admin/bin-rentals/[orderId]` (page.tsx:155). Manual create not supported (quote path covers it) | Low |
| G Client track | ✅ Complete | `isTrackNonMoveProduct` strips crew/truck/inventory/checklist/map; bin copy | Low |
| H Confirmed page | ⚠️ Defaulted | serviceVerb="move", "Move date", "Prepare your space / photo request" | Medium |
| L Email | ✅/⚠️ | Dedicated `binRentalConfirmationEmail` ✅; no bin-specific prep/post-pickup review in main suite (separate bin crons exist); T-48h balance reminder still fires | Medium |
| M SMS | ✅ Complete | Bin variant confirmation + dedicated bin-reminders/overdue crons | Low |
| N HubSpot | ⚠️ Partial | service_type enum = "Other" | Low |

---

## B2B VERTICAL GAPS

**Architecture:** all 11 verticals driven by one `delivery_verticals` DB table + the universal dimensional engine `calculateB2BDimensionalPrice` (b2b-dimensional.ts:449) via `calcB2bOneoff` (quotes/generate/route.ts:3235). Track page, crew brief, and POD email are **generic/shared** across all verticals (functional, not vertical-branded). **No vertical is just a label with nothing behind it.**

| Vertical | Rate card | Pricing | Quote fields | Client hero | Track | Portal | Invoice | Crew | Email |
|---|---|---|---|---|---|---|---|---|---|
| Cabinetry | ⚠️ dual | ⚠️ divergent | ✅ | ⚠️ fallback | ✅ gen | ✅ | ✅ | ⚠️ gen | ✅ gen |
| Flooring | ⚠️ dual | ⚠️ divergent | ✅ | ✅ | ✅ gen | ✅ | ✅ | ⚠️ gen | ✅ gen |
| Appliance | ⚠️ dual | ⚠️ divergent | ✅ | ✅ | ✅ gen | ✅ | ✅ | ⚠️ gen | ✅ gen |
| Furniture Retail | ✅ | ✅ | ✅ | ✅ | ✅ gen | ✅ | ✅ | ⚠️ gen | ✅ gen |
| Interior Designer | ✅ | ✅ | ✅ | ✅ | ✅ gen | ✅ +Projects | ✅ | ⚠️ gen | ✅ gen |
| Art & Gallery | ✅ | ✅ | ✅ | ✅ | ✅ gen | ✅ +Projects | ✅ | ⚠️ gen | ✅ gen |
| Restaurant/Hosp. | ✅ | ✅ | ✅ | ✅ | ✅ gen | ✅ | ✅ | ⚠️ gen | ✅ gen |
| Office/Commercial | ✅ | ✅ | ✅ | ⚠️ fallback | ✅ gen | ✅ | ✅ | ⚠️ gen | ✅ gen |
| E-Commerce/Bulk | ✅ | ✅ | ✅ | ✅ | ✅ gen | ✅ | ✅ | ⚠️ gen | ✅ gen |
| Medical/Lab | ✅ | ✅ | ✅ | ✅ | ✅ gen | ✅ | ✅ | ⚠️ gen | ✅ gen |
| Custom/Other | ✅ | ✅ | ✅ | ✅ | ✅ gen | ✅ | ✅ | ⚠️ gen | ✅ gen |

**Key vertical gaps:**
1. **Divergent pricing engines (cabinetry / flooring / appliance) — High.** `calcCabinetPrice`/`calcAppliancePrice` (b2b/cabinet-pricing.ts) and `calcFlooringPrice` (b2b/flooring-pricing.ts) read a *separate* `platform_config.b2b_rate_card` and are called **only** by the admin pricing preview (`admin/b2b-delivery/pricing-preview/route.ts:129`). The live customer quote uses the dimensional row. **Admin preview and the real quote can produce different totals.**
2. **Missing client hero copy — Medium.** `cabinetry` and `office_furniture` have no entry in `b2b-quote-copy.ts:190` → silently fall to the generic "Specialty Transport / Custom" hero.
3. **No vertical branding in track / crew brief / POD email — Medium.** One-size-fits-all (`track/delivery/[id]/`, `crew/.../job/[type]/[id]/page.tsx:1544`, `b2b-delivery-business-notifications.ts`).
4. **HVAC partner vertical has no delivery row — Low.** Maps to `custom` (vertical-config.ts:322); AV→`office_furniture`, antique→`art_gallery`.
5. **`ecommerce` vs `ecommerce_bulk` alias footgun — Low.** Only `ecommerce_bulk` is the seeded DB code; normalization handles it but it's fragile.

---

## EMAIL AUDIT

### Root cause of the confirmation gap
`post-payment.ts:610` — `templateFns[tier] ?? signatureConfirmationEmail` with `tier = selectedTier ?? "signature"`. Only `local_move`/`long_distance` are tiered; all other move-path types store `tier_selected = null` (create-move-from-quote.ts:168), so **white_glove, specialty, event, labour_only** hit the residential Signature template. `office_move` is gated on `tier==="priority"` or it too falls to Signature.

### Confirmation email coverage
| Service type | Confirmation email | Verdict |
|---|---|---|
| local_move / long_distance | tier templates (essential/curated/signature/estate) | ✅ |
| office_move | `officeConfirmationEmail` **only if tier=priority**, else Signature | ⚠️ |
| single_item | `singleItemConfirmationEmail` (dedicated) | ✅ |
| bin_rental | `binRentalConfirmationEmail` (dedicated) | ✅ |
| white_glove / specialty / event / labour_only | **residential Signature fallback** | ❌ High |
| b2b_delivery / b2b_oneoff | **none** (internal admin alert only) | ❌ High |
| b2b_outbound_stage | outbound staging suite (dedicated) | ✅ |
| b2b inbound / RISSD | inbound stakeholder suite (dedicated) | ✅ |

### Other email findings
- **Pre-move sequence (T-5d/3d/72h/48h/24h)** only serves full relocations (local/long_distance/office). Office has 72h/24h variants ✅. All delivery-like types excluded (mostly correct, but no delivery-appropriate pre-arrival email exists).
- **Day-of checkpoint email** branches move (residential/estate/office) vs delivery; white_glove/specialty/event get generic residential-move stage copy ("heading to your new home") — wrong for in-home/event.
- **Post-move** (review/perks/anniversary) fires for every completed move with residential copy ("One year ago today we moved you") regardless of type.
- Documented fallbacks: post-payment.ts:588 (office was Estate placeholder until 2026-06-30), :600 (Priority residential keeps Estate copy), :610 (Signature catch-all). No open TODO/FIXME.

---

## SMS AUDIT (all via OpenPhone, single chokepoint `sms/sendSMS.ts:46`)

- **Quote SMS is the most service-type-aware** (move/delivery/bin/event variants). Everything downstream degrades.
- **Booking confirmation SMS** has variants for Estate, office-Priority, bin_rental only; all other types get generic move copy. Event has **no** confirmation SMS variant. b2b_delivery org path sends **no** confirmation SMS.
- **Pre-move reminder SMS (`quote-sms.ts:224`) is hardcoded** "move"/"crew"/"tomorrow" regardless of service_type; 72hr silently skipped for non-relocations while generic 24hr still fires (inconsistent cadence).
- **ETA SMS (`etaMessages.ts`) hardcoded to "move"** even when sent to `delivery.end_customer_phone`.
- **Day-of client SMS (`client-tracking-sms.ts:18`)** has move/estate/delivery branches only — no office/event branch.
- Dead code: `quote-sms.ts:224 reminderType:"confirmation"` has no caller.
- Correctly suppressed: move-day checklist link gated by `isFullRelocationMove`; crew names never in external SMS.

**Missing SMS (prioritized):** b2b_delivery booking confirmation (High), event confirmation + day-of copy (High), office day-of copy (Med), service-type-aware pre-move reminders (Med), b2b_outbound_stage all stages (Med).

---

## CREW APP AUDIT

Flow engine (`getCrewStatusFlowForMove`, service-type-flow.ts:168) genuinely branches per archetype; data plumbing (serviceType + whiteGloveKind from `factors_applied`) is correct.

| Service type | Job detail | Stages | Verdict |
|---|---|---|---|
| long_distance | ✅ | ✅ (aliased to residential) | OK |
| single_item / white_glove / b2b_delivery / labour_only / bin_rental | ✅ | ✅ | OK |
| office_move | ⚠️ | ⚠️ | Crew gets 6-step flow; **no Day-1 pack/IT stages** (12-step office flow used only by client) — **High** |
| event | ✅ | ⚠️ | Round-trip flow correct, but **inventory walkthrough gate misfires** at arrived_at_pickup with residential copy — Med |
| specialty | ⚠️ | ❌ | No mapper entry → residential loading/unloading + walkthrough — Med |
| b2b_outbound_stage | ⚠️ | ❌ | No mapper entry → residential default — Med |

**Cross-cutting:** the inventory walkthrough gate (page.tsx:1171) is archetype-blind — fires for office/event/specialty/single_item/b2b at `arrived_at_pickup`; only b2b logistics copy is swapped ("Job List Verification"), office/event/specialty get literal residential inventory copy.

---

## CLIENT TRACK AUDIT

**Two systems:** `track/move/[id]` (moves table) and `track/delivery/[id]` (deliveries table); only b2b_delivery/b2b_oneoff use the delivery track. **Booking-confirmed page (`quote/[quoteId]/confirmed`) has NO link to any track page** for any type, and defaults to serviceVerb="move" + "Prepare your space / photo request" for event/bin/labour/long_distance/specialty.

- **No stakeholder/multi-viewer model** — `share-tracking` issues one deterministic HMAC link (delivery has ≤2 audience links); office hero's "share with your team" is the same single token, no per-viewer scoping/revocation.
- **Multi-day** only handled for office (`OfficeTrackHero`, ≥2 days) and Estate; no LD-transit multi-day.
- **Residential UI leaks:** room-grouped inventory (TrackInventory.tsx:179) for office/event/specialty/LD/labour/outbound; "en route to your home" copy for any non-logistics move. Pre-move checklist correctly suppressed via `isFullRelocationMove`.
- **Worst:** b2b_outbound_stage (no track at all → residential shell) and event/labour (no branch, distinct DB stages render blank).

---

## PARTNER PORTAL AUDIT

Shipped and live, gated by `partner_portal` platform toggle; three experiences (delivery / PM-portfolio / referral). **No Critical gaps.**

| Capability | Status | Notes |
|---|---|---|
| Delivery-partner job visibility | ✅ | Today/History/Calendar/LiveMap wired |
| PM-partner portal | ✅ | Separate moves/buildings/calendar |
| Referral (realtor) | ⚠️ | `realtor` has **no portal** (by design); property_manager does |
| Inbound shipment view | ⚠️ | Flat read-only table; no timeline/inspection/photos/storage fees; "Inbound" tab shown to all non-referral partners even when always-empty |
| Storage tracking | ⚠️/✅ | Thin in inbound tab; rich in B2B Projects tab (different data model) |
| Invoices (delivery) | ✅ | `invoices`+`partner_statements` with pay links; but never queries `partner_invoices` (PM Square path) → potential silo |
| Invoices (PM) | ✅ | Square pay links in PM statements |
| Receipt button (delivery) | ⚠️ | Dead — `portal-data` select omits `square_receipt_url` |
| Outbound staging visibility | ❌ | Only a public token page (`outbound/track/[id]?token=`), not in the authenticated portal |

---

## HUBSPOT & SQUARE AUDIT

Both are service-type-aware via central mapping tables. **No fallback-to-residential; no TODO/placeholder.**

**HubSpot** — quote-send creates a deal for any service_type; stage mapping is status-driven and uniform. Gaps: `labour_only`/`bin_rental` map to service_type enum **"Other"** (deal creates, reporting can't distinguish); **`b2b_outbound_stage` has no deal path**; unmapped commercial `access` slugs (loading_dock/concierge/long_carry) silently omitted → blank on B2B/office deals.

**Square** — B2C (all move-path types incl. long_distance/office/single_item/white_glove/specialty/event/labour_only) uses one deposit+balance card-charge flow, service-type-agnostic. B2B/PM uses Square invoices. bin_rental uses its own `payments.create` (full pay). Deposit policy per type: specialty/event = full at booking; labour_only = $150 flat or full if <4 days; bin = full. **Tax risk:** every invoice path recomputes HST as `subtotal × 0.13` (square-invoice.ts:265, pm-invoicing.ts:323, deal-properties-builder.ts:217) rather than using `contractTaxFromMove` — a correctness risk on B2B rows where the pre-tax base is stored ambiguously (matches the known tax-convention memory).

---

## MASTER PRIORITIZED GAP LIST

### CRITICAL (release-blocking)
1. **`b2b_outbound_stage` books as a residential move** — not routed to delivery creator; no move_type mapping → defaults residential. `b2b-quote-copy.ts:9-11`, `create-move-from-quote.ts:59-70,370`, `payments/process/route.ts:596`.
2. **Edit-Quote regenerate is ungated** for event / bin_rental / b2b_outbound_stage, and `isB2bQuote` only matches `b2b_delivery` (misses `b2b_oneoff`/`b2b_outbound_stage`) — bottom button `EditQuoteClient.tsx:3248` bypasses guards → residential re-price destroys scope.
3. **Event scope destroyed on edit-regenerate** — no event branch in `buildPayload` (EditQuoteClient.tsx).

### HIGH
4. **No dedicated confirmation email** for white_glove / specialty / event / labour_only (residential Signature fallback) — `post-payment.ts:610`.
5. **No client booking confirmation (email + SMS)** for b2b_delivery — `post-payment.ts:1316`.
6. **Office crew flow missing Day-1 pack/IT stages** — `service-type-flow.ts:180` vs `crew-tracking-status.ts:111`.
7. **Office client timeline empty during pack day** — `timeline/route.ts:12-23`.
8. **Event client track has no branch** (blank venue/teardown stages) — `TrackMoveClient.tsx`.
9. **Manual Create-Move drops office/single_item/specialty scope fields** — `api/admin/moves/create/route.ts`.
10. **b2b_outbound_stage** — no HubSpot deal, no quote scope UI, no client layout, no track.
11. **B2B cabinetry/flooring/appliance divergent pricing** (admin preview ≠ live quote) — `pricing-preview/route.ts:129`.
12. **labour_only client track** residential-defaulted; **b2b_delivery multi-stop stepper** doesn't track current stop.

### MEDIUM
13. Event/office/specialty crew inventory-walkthrough gate misfires (archetype-blind) — `crew/.../page.tsx:1171`.
14. Quote-detail (surface B) lacks scope rendering for single_item/white_glove/specialty/labour_only/bin_rental/outbound.
15. Booking-confirmed page defaults 5 types to "move" copy + no track link.
16. Fabricated "$5M cargo insurance" hardcoded in LongDistance + Specialty layouts when factors absent.
17. Service-type-blind pre-move + ETA SMS ("move"/"crew" for deliveries/labour/events).
18. HST recomputed × 0.13 instead of `contractTaxFromMove` (tax-convention risk).
19. Manual create can't produce long_distance / bin_rental; single_item detail block gated on factors.

### LOW
20. HubSpot "Other" enum for labour_only/bin_rental; unmapped commercial access slugs.
21. Dead code: `ldTruckSur`/`ldTruckLine`, `truckBreakdown=null`, computed-but-unused `deposit` (specialty/event), duplicate B2B CTA branch, dead receipt button in delivery portal, dead `reminderType:"confirmation"` SMS.
22. Missing B2B client hero copy (cabinetry, office_furniture); HVAC no delivery row; ecommerce alias footgun.
23. Partner portal: outbound not in authenticated portal; thin inbound view; realtor no portal.

---

*Read-only audit. No files modified. Evidence gathered via 9 parallel surface audits + direct verification.*
