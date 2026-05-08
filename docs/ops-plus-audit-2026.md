# yugo+ System Audit — 2026-05-07

## Scope

Full audit of the yugo+ OPS+ application covering: security, data integrity, business logic, financial reporting, integrations, and operational gaps.

---

## Section 1 — Security & Authentication

### 1.1 Admin API Route Protection ✅ PASS
All routes under `/api/admin/` use `requireAdmin()` or `requireStaff()`. No unprotected admin endpoints found.

### 1.2 Partner Route Protection ✅ PASS
All `/api/partner/` routes use `requirePartner()`. RLS enforced at the application layer.

### 1.3 Owner-Only Routes ✅ PASS
Platform settings (`/api/admin/platform-settings`) is gated behind `requireOwner()` — not accessible to staff-level admins.

### 1.4 Square Idempotency Keys ✅ PASS
`lib/square-invoice.ts` generates idempotency keys for payment requests. Duplicate charge risk is mitigated.

---

## Section 2 — Quote Lifecycle

### 2.1 Quote Expiry Not Reset on Bulk Resend ⚠️ HIGH
**File:** `src/app/api/admin/quotes/bulk/route.ts:35`
**Problem:** The `resend` action sets `{ status: "sent", sent_at, updated_at }` but does NOT update `expires_at`. If the original quote had an `expires_at` in the past (i.e. it expired), resending it resets the status to `"sent"` but leaves the expiry date unchanged. `isQuoteExpiredForBooking()` still returns `true`, so clients cannot pay.
**Fix:** Add `expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString()` to the resend update payload.

### 2.2 Null expires_at Treated as Never-Expiring ✅ ACCEPTABLE
`src/lib/quote-expiry.ts:11` — `if (!quote.expires_at) return false;` means quotes without an expiry date never expire. This is intentional for quotes created via certain channels. Not a bug, but worth noting.

### 2.3 Quote-to-Move ID Continuity ✅ PASS
`convertedRecordCodeFromQuoteId` preserves sequence numbers across quote→move (YG-30211 → MV-30211). Working correctly.

### 2.4 HubSpot Duplicate Deal Prevention ✅ PASS
Contact deduplication logic exists in the HubSpot sync layer. No duplicate deal risk identified.

### 2.5 Tier-Range Quotes Now Have Booking Flow ✅ FIXED (this session)
`ExternalBookingModal` + `POST /api/admin/quotes/[quoteId]/book-external` implemented. Idempotent (returns existing move if already booked). Validates tier exists in quote's `tiers` JSON before proceeding.

---

## Section 3 — Move & Delivery Lifecycle

### 3.1 Multi-Day Project Day Completion Has No Cascade ⚠️ HIGH
**File:** `src/app/api/admin/move-projects/[id]/days/[dayId]/complete/route.ts`
**Problem:** When a move project day is marked complete, the route only updates that specific day's `status` and `completion_notes`. It does not check whether all days in the project are now complete, nor does it cascade a status update to the parent move.
**Fix:** After updating the day, query all other days for `projectId`. If every day has `status` of `"completed"` or `"cancelled"`, update the parent move's status to `"completed"`.

### 3.2 Delivery Override Price Not Audit Logged ⚠️ HIGH
**File:** `src/app/api/admin/deliveries/[id]/route.ts:83-91`
**Problem:** The route validates that `override_reason` is required when `override_price` is set — but it never calls `logActivity()` to record the override in the audit trail. Financial overrides are untracked.
**Fix:** Add `logActivity({ entity_type: "delivery", entity_id: id, event_type: "price_override", ... })` when `override_price` is set.

### 3.3 Completed Deliveries Auto-Update Project Inventory ✅ PASS
Lines 199–255: When a delivery is completed, project inventory items linked to that delivery are automatically marked as `"delivered"`, logged to `project_status_log`, and a timeline entry is written. Correct.

---

## Section 4 — Financial Reporting

### 4.1 Revenue Page Used Stale `amount` Instead of `final_amount` ✅ FIXED (this session)
**Files:** `src/app/admin/revenue/RevenueClient.tsx`, `src/app/api/admin/profitability/route.ts`, `src/app/api/partner/pm/*.ts`
**Fix applied:** Priority chain `final_amount ?? total_price ?? amount ?? estimate` now applied across all 6 financial report files.

### 4.2 Partner PM Revenue Routes ✅ FIXED (this session)
`/api/partner/pm/buildings`, `/api/partner/pm/summary`, `/api/partner/pm/move-history` all updated to use the full priority chain.

---

## Section 5 — Platform Settings & Configuration

### 5.1 Platform Settings Changes Not Logged ⚠️ HIGH
**File:** `src/app/api/admin/platform-settings/route.ts`
**Problem:** The PATCH handler updates toggles (`crew_tracking`, `partner_portal`, `auto_invoicing`) and office location with no audit trail. Owner-level changes to operational toggles are invisible in activity logs.
**Fix:** After the successful update, call `logActivity()` recording which fields changed, their old and new values.

### 5.2 No Settings Changelog Table ⚠️ MEDIUM
There is no `settings_changelog` table in the database. The `platform_config` table holds key/value pairs but changes are not version-controlled. This means historical setting values cannot be recovered.
**Fix (deferred):** Consider adding a `settings_changelog` table with `key`, `old_value`, `new_value`, `changed_by`, `changed_at`. For now, `logActivity` is the interim solution.

---

## Section 6 — Crew & Tip Reporting

### 6.1 Tip Reporting Skippable in Crew App ⚠️ MEDIUM
The crew app tip reporting flow has no server-side enforcement. If a crew member dismisses or skips the tip entry screen, no error is thrown and no record is created. Tips collected by crew cannot be reliably audited.
**Fix (deferred):** Add a `tip_reported_at` timestamp to moves. Flag moves where `move_date` is more than 24 hours ago and `tip_reported_at` is null but crew was assigned.

### 6.2 Labour Rate Check Visibility for B2B Quotes ⚠️ MEDIUM
`QuoteFormClient.tsx:11613` — the "Above ceiling" labour rate warning fires based on `quoteResult.labour_validation`. The condition for B2B quotes was not fully explored — it may suppress the warning for corporate moves where rate validation is still relevant.
**Fix:** Verify `labour_validation` is computed and surfaced for both residential and B2B service types.

---

## Section 7 — Integrations

### 7.1 HubSpot Deal Sync on External Booking ✅ COVERED
`runPostPaymentActions` is called non-blocking from `book-external` route. HubSpot deal stage sync is part of post-payment pipeline.

### 7.2 GCal Sync Gaps ✅ PREVIOUSLY FIXED
GCal sync was addressed earlier in the session for delivery scheduling changes.

---

## Section 8 — Data Integrity

### 8.1 external_booking Columns Migration ✅ FIXED (this session)
`supabase/migrations/20260508100000_external_booking_columns.sql` applied. `externally_booked`, `booked_via`, `booking_notes` columns added to both `quotes` and `moves` tables.

### 8.2 Quote tiers JSON Integrity
The `tiers` JSONB column has no DB-level schema validation. Invalid tier keys or missing `price` fields would be silently accepted. Application-layer guards exist in `book-external` route. Acceptable for current scale.

---

## Summary Table

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 2.1 | `expires_at` not reset on bulk resend | HIGH | **TO FIX** |
| 3.1 | Multi-day project day → no cascade to parent move | HIGH | **TO FIX** |
| 3.2 | Delivery override price not audit logged | HIGH | **TO FIX** |
| 5.1 | Platform settings changes not logged | HIGH | **TO FIX** |
| 4.1 | Revenue pages used stale `amount` field | HIGH | ✅ Fixed |
| 2.5 | Tier-range quotes had no booking flow | HIGH | ✅ Fixed |
| 8.1 | Missing external booking DB columns | HIGH | ✅ Fixed |
| 6.1 | Tip reporting skippable | MEDIUM | Deferred |
| 6.2 | Labour rate check for B2B quotes | MEDIUM | Deferred |
| 5.2 | No settings changelog table | MEDIUM | Deferred |
| 2.2 | Null expires_at = never expires | LOW | Acceptable |
