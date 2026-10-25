# OPS+ Finance Metrics Dictionary (canonical)

Status: **proposed — pending sign-off**. Once locked, every dashboard reads these
definitions from one shared module (`src/lib/finance/metrics.ts`), so the same
metric returns the same number wherever it appears.

Why we need this: today four dashboards show four "revenues" ($138,751 /
$152,421 / $139.8K / $127.9K) because each uses a different scope, amount field,
tax basis and date basis. See "Reconciliation" at the end.

---

## 0. Principles

1. **One source of truth.** A metric is computed in exactly one function in
   `src/lib/finance/metrics.ts`. Dashboards call it; they never re-aggregate.
2. **Pre-tax by default.** HST is a pass-through, not revenue. Every revenue /
   profit / pipeline figure is **pre-tax** unless the metric is literally about
   cash. "Cash collected" and "AR" are shown pre-tax and gross (both labelled).
3. **Three date bases, never mixed inside one metric:**
   - **Service date** — when the job is performed (`scheduled_date` → `completed_at`). Used for earned revenue, profit, operational metrics.
   - **Payment date** — when money moved (`payment_marked_paid_at` / invoice `paid_at`). Used for cash metrics only.
   - **Booking date** — when the deal was won (`booked_at` / move `created_at`; quote `accepted_at`). Used for sales/bookings metrics.
4. **Explicit status taxonomy** (one word, used everywhere):
   - **Pipeline** — open quote, not yet won or lost.
   - **Won / Booked** — quote accepted → a move/delivery exists (status confirmed, scheduled, in_progress, completed, delivered, paid).
   - **Performed** — job done: status in {completed, delivered} (or a completed crew sign-off / tracking session).
   - **Collected** — payment received.
   - **Outstanding** — invoiced and unpaid.
   - **Cancelled** — excluded from every metric.
5. **Canonical money helpers (the only pre-tax truth):**
   - Move / PM move: `contractTaxFromMove(move).preTax` (format-currency.ts).
   - Delivery: `deliveryPreTaxForAdminList(delivery)` (delivery-pricing.ts).
   - Partner invoice: `invoicePreTaxForDisplay(invoice)` (delivery-pricing.ts).
   - Direct job cost: `calculateMoveProfitability` (moves) / the delivery cost model.
6. **Client segment is separate from service tier** (see §4). Every segmented
   metric uses `getCustomerSegment(job)` so Springfield reads as
   *Property Management / Contracted*, never "Essential".

---

## 1. Financial performance

What we actually earned and kept. Recognized on **service date**, pre-tax.

| Metric | Definition | Date basis | Tax | Status filter |
|---|---|---|---|---|
| **Earned revenue** | Pre-tax value of jobs performed in the period (moves + PM + deliveries + events, each via its canonical pre-tax helper) | Service date | Pre-tax | Performed |
| **Gross profit** | Earned revenue − direct job costs (labour, truck/fuel, supplies) | Service date | Pre-tax | Performed |
| **Gross margin** | Gross profit ÷ earned revenue | Service date | Pre-tax | Performed |
| **Operating expenses** | Period overhead not charged to a job: fixed OH (owned trucks/insurance/admin), rented-truck day rates, platform/marketing | Calendar period | Pre-tax | n/a (period expense) |
| **Net operating profit** | Gross profit − operating expenses | Service date / period | Pre-tax | Performed |
| **Cash collected** | Payments received in the period (deposits + balances + invoice payments) | Payment date | Gross + pre-tax split shown | Collected |
| **Accounts receivable** | Invoiced amounts still unpaid as of the date (B2B invoices sent, PM invoices sent, completed-unbilled) | As-of date | Pre-tax | Outstanding |

Note: Earned revenue ≠ Cash collected. A Nov job booked+paid in Oct is cash in
Oct, earned revenue in Nov. Both are correct; they answer different questions.

---

## 2. Sales performance

What we are winning and will win. Recognized on **booking date** (or as-of for open pipeline).

| Metric | Definition | Date basis | Tax | Status filter |
|---|---|---|---|---|
| **Qualified pipeline** | Pre-tax value of open quotes (sent or viewed, not yet won/lost/expired) as of now | As-of | Pre-tax | Pipeline |
| **Closed-won bookings** | Pre-tax value of jobs won (quote accepted → move/delivery created) in the period, regardless of whether performed yet | Booking date | Pre-tax | Won |
| **Average contract value** | Closed-won bookings ÷ number of jobs won | Booking date | Pre-tax | Won |
| **Quote-to-close rate** | Won ÷ (won + lost + expired) for quotes created in the period | Quote date (cohort) | n/a | Quote outcome |
| **Repeat business** | Share of closed-won bookings (count and $) from clients/accounts with a prior completed job | Booking date | Pre-tax | Won + has prior |
| **Revenue by acquisition source** | Closed-won bookings grouped by `how_found` / `referral_source` | Booking date | Pre-tax | Won |
| **Forecasted bookings** | Expected bookings for the next N days: open pipeline weighted by stage win-rate + already-scheduled unperformed jobs | Forward | Pre-tax | Pipeline + scheduled |

This view is where **HubSpot ties in**: "closed-won bookings" (pre-tax) is the
in-app equivalent of HubSpot's closed-won deal sum; the ~$210K HubSpot figure is
that number **tax-inclusive** in HubSpot's own report.

---

## 3. Operational performance

How efficiently we deliver. Recognized on **service date**, pre-tax.

| Metric | Definition | Date basis | Tax | Status filter |
|---|---|---|---|---|
| **Completed jobs** | Count of jobs performed in the period (events counted once) | Service date | n/a | Performed |
| **Jobs by service type** | Completed jobs grouped by `service_type` (local, white-glove, event, single-item, labour, office, B2B delivery, PM) | Service date | n/a | Performed |
| **Revenue per crew-day** | Earned revenue ÷ crew-days worked (Σ crew size × job-days) | Service date | Pre-tax | Performed |
| **Gross profit per crew-hour** | Gross profit ÷ crew-hours worked | Service date | Pre-tax | Performed |
| **Capacity utilization** | Crew-days scheduled ÷ crew-days available in the period | Period | n/a | Scheduled |
| **Revenue by client segment** | Earned revenue grouped by `getCustomerSegment` (Private Client / Contracted / Property Management) | Service date | Pre-tax | Performed |
| **Margin by service line** | Gross margin per service line (local / white-glove / event / B2B / PM …) | Service date | Pre-tax | Performed |

---

## 4. Customer segment vs service tier (item #1)

Two independent dimensions, never conflated:

- **Customer segment** (who): `Private Client` · `Contracted` (B2B one-off / partner) · `Property Management` (PM accounts like Springfield). Derived by `getCustomerSegment(job)` from `is_pm_move` / `contract_id` / organization type / `service_type` — no new column needed; applies retroactively.
- **Service tier / line** (what): residential tier (`Essential` / `Signature` / `Estate`) for tiered residential moves only; otherwise the service line (`Event`, `Single item`, `Labour`, `Office`, `B2B delivery`, `PM turnover`).

Example: a Springfield turnover = segment **Property Management**, service line **PM turnover (reno move-in)** — never "Essential". A homeowner white-glove move = segment **Private Client**, tier **Signature**.

---

## 5. Reconciliation of today's conflicting numbers

| Today's figure | Where | What it really is | Maps to canonical metric |
|---|---|---|---|
| **$138,751** | Moves — "Booked estimate" | Pre-tax value of **all** move rows, any status, no date, moves only | ≈ Closed-won bookings (moves only, lifetime) — relabel "Booked (moves, lifetime)" |
| **$152,421** | Profitability — "Total revenue" | Completed jobs YTD, all lines, pre-tax, service date | **= Earned revenue (YTD)** — this is the canonical one |
| **$139.8K** | Revenue — "2026 YTD" | Paid moves + PM + partner, this year, **tax-inclusive on moves**, payment date | Broken (mixed tax). Replace with Earned revenue (service date) and Cash collected (payment date), both pre-tax |
| **$127.9K** | Revenue — "Combined" | Same 3 sources, **lifetime**, pre-tax | ≈ Cash collected (lifetime) — relabel; stop mixing with YTD |
| **~$210K** | HubSpot | Closed-won deal amounts, tax-inclusive | ≈ Closed-won bookings, but tax-incl + HubSpot scope |

**The one true bug** to fix regardless: the Revenue page values moves at
`estimate` (pre-tax) in "Combined" but at `final_amount` (tax-inclusive) in
"YTD"/monthly — so it contradicts itself. Everything routes through the canonical
helpers to end this.

---

## 6. Implementation plan (phased)

1. **Metrics module** `src/lib/finance/metrics.ts` — one function per metric
   above, each taking a period + filters, built on the canonical money helpers.
   Plus `getCustomerSegment`. Unit-tested against known rows.
2. **Reconcile the Revenue page** onto the module (kills the estimate-vs-final
   contradiction) and relabel every tile Booked / Earned / Collected / Outstanding.
3. **Segment everywhere** — wire `getCustomerSegment` into Moves, Revenue, Profitability.
4. **Account & contract profitability** (item #2) — per-account rollup: earned
   revenue, job count, gross profit, avg ticket, repeat frequency.
5. **Three dashboard views** — Financial / Sales / Operational, each reading the module.

Every metric in this doc carries its definition, date basis, tax treatment and
status filter, and is implemented once — satisfying "same metric, same result,
everywhere in OPS+".
