# yugo+ Audit Fixes Applied — 2026-05-07

## Fix 1 — expires_at not reset on bulk quote resend
**File:** `src/app/api/admin/quotes/bulk/route.ts:35`
**Problem:** Resending a quote set `status: "sent"` but left the old `expires_at` unchanged. If the quote had previously expired, the client still couldn't pay.
**Fix:** Added `expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString()` to the resend update payload. Resent quotes now get a fresh 7-day window.

## Fix 2 — Multi-day project days not cascading to project status
**File:** `src/app/api/admin/move-projects/[id]/days/[dayId]/complete/route.ts`
**Problem:** Marking a project day complete only updated that day's record. The parent `move_projects` row was never updated, leaving completed multi-day projects in a perpetually non-complete state.
**Fix:** After updating the day, all days for the project are queried. If every day has status `completed` or `cancelled`, the parent `move_projects` row is updated to `status: "completed"`.

## Fix 3 — Delivery price overrides not audit logged
**File:** `src/app/api/admin/deliveries/[id]/route.ts`
**Problem:** The `override_price` validation required an `override_reason` string, but no activity log entry was written. Financial overrides were invisible in the audit trail.
**Fix:** Added `logActivity({ entity_type: "delivery", event_type: "price_override", ... })` call after successful update when `override_price` is set. Logs the new price, delivery number, and reason.

## Fix 4 — Platform settings changes not logged
**File:** `src/app/api/admin/platform-settings/route.ts`
**Problem:** Owner-level toggle changes (`crew_tracking`, `partner_portal`, `auto_invoicing`, office location) were applied silently with no audit trail.
**Fix:** Added `logActivity({ entity_type: "settings", event_type: "settings_changed", ... })` after each successful PATCH, listing exactly which settings changed.

---

## Previously Fixed (same session)

- **Revenue/profitability pages:** Priority chain `final_amount ?? total_price ?? amount ?? estimate` applied across 6 files.
- **External booking flow:** `ExternalBookingModal` + `POST /api/admin/quotes/[quoteId]/book-external` for tier-range quotes.
- **DB migration:** `externally_booked`, `booked_via`, `booking_notes` columns added to `quotes` and `moves`.
