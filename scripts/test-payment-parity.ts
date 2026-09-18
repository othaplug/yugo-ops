/**
 * Payment parity suite — the guardrail for the "half-a-refactor" class of bug
 * that broke bookings in September 2026 (server tightened the deposit/full-
 * payment gate while the client + admin surfaces stayed on the old policy, so
 * clients hit "refresh the page and try again" and could not pay).
 *
 * It asserts, for every service_type across the 48h boundary and the <4-day
 * short-notice band, that the CLIENT charge (what the quote page instructs the
 * client to pay, via calculateDeposit) is never below the SERVER minimum (the
 * exact gate reproduced from payments/process). When those two disagree, the
 * booking is blocked — so this suite fails at merge instead of at the client.
 *
 * It is deliberately dependency-free (no test framework — none is installed):
 * run with `npm run test:payments` (npx tsx scripts/test-payment-parity.ts).
 * Exit code is non-zero on any failure, so CI can gate on it.
 *
 * SCOPE / HONESTY: this tests the shared source-of-truth FUNCTIONS the fixed
 * surfaces call (client calculateDeposit vs the server gate primitives). It
 * cannot reach into a React useMemo directly. The durable guarantee that every
 * surface calls these functions is follow-up #1 (a single paymentPolicy(quote)
 * helper); this suite is the safety net that lands first.
 */

import {
  calculateDeposit,
  isFullPaymentAtBookingService,
} from "@/app/quote/[quoteId]/quote-shared";
import { decideBookingPayment } from "@/lib/quotes/booking-payment-window";
import {
  residentialTierDeposit,
  EVENT_FULL_PAYMENT_UNDER,
} from "@/lib/quotes/residential-deposit";

const TAX = 0.13;
const incl = (preTax: number) => Math.round(preTax * (1 + TAX));

// ── tiny assertion harness ──
let passed = 0;
const failures: string[] = [];
function assert(cond: boolean, label: string) {
  if (cond) passed += 1;
  else failures.push(label);
}

function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Reproduce the server gate in src/app/api/payments/process/route.ts exactly:
 * the minimum amount the client must submit or the booking is rejected.
 */
function serverMinRequired(quote: {
  service_type: string;
  move_date: string | null;
  custom_price: number;
  deposit_amount: number;
  tiers?: Record<string, { price: number; total: number }> | null;
  selected_tier?: string | null;
}): number {
  const svc = quote.service_type;
  const customPrice = Number(quote.custom_price ?? 0);
  let depositOnQuote = Number(quote.deposit_amount ?? 0);
  let grandTotal = customPrice > 0 ? incl(customPrice) : depositOnQuote;

  if (svc === "local_move") {
    const tierKey = String(quote.selected_tier ?? "essential");
    const row = quote.tiers?.[tierKey];
    const tierPrice = row ? Number(row.price ?? 0) : 0;
    if (tierPrice > 0) {
      depositOnQuote = residentialTierDeposit(tierKey, tierPrice);
      grandTotal = row && row.total != null ? Number(row.total) : incl(tierPrice);
    }
  }

  const decision = quote.move_date
    ? decideBookingPayment({
        moveDate: quote.move_date,
        deposit: depositOnQuote,
        grandTotal,
        serverSide: true,
      })
    : { requireFullPayment: false };
  const fullByService = isFullPaymentAtBookingService(svc);

  return decision.requireFullPayment || fullByService
    ? Math.floor(grandTotal * 0.98)
    : Math.floor(depositOnQuote * 0.98);
}

// ── Scenario matrix ──
const WINDOWS: { name: string; days: number }[] = [
  { name: "outside (10d)", days: 10 },
  { name: "short-notice (3d)", days: 3 },
  { name: "inside-48h (1d)", days: 1 },
];

type Svc = {
  svc: string;
  preTax: number;
  tier?: string;
  /** stored deposit_amount to seed on the row (default: the correct client charge) */
  stale?: boolean;
};

const SERVICES: Svc[] = [
  { svc: "local_move", preTax: 3000, tier: "essential" },
  { svc: "local_move", preTax: 3000, tier: "signature" },
  { svc: "local_move", preTax: 3000, tier: "estate" },
  { svc: "local_move", preTax: 900, tier: "essential" }, // 10% < $150 floor band
  { svc: "long_distance", preTax: 6000 },
  { svc: "office_move", preTax: 8000 },
  { svc: "labour_only", preTax: 1200 },
  { svc: "event", preTax: 4000 }, // > $2,500 incl → 30%
  { svc: "event", preTax: 1500 }, // ≤ $2,500 incl → full
  { svc: "white_glove", preTax: 1000 },
  { svc: "specialty", preTax: 2000 },
  { svc: "single_item", preTax: 800 },
  { svc: "bin_rental", preTax: 600 },
  { svc: "b2b_oneoff", preTax: 1500 },
  { svc: "b2b_delivery", preTax: 2500 },
];

/** The deposit_amount the generate route would store = what the client charges. */
function storedDeposit(s: Svc, moveDate: string): number {
  return calculateDeposit(s.svc, incl(s.preTax), s.tier, moveDate);
}

function buildQuote(s: Svc, moveDate: string, staleDeposit?: number) {
  const preTax = s.preTax;
  const tiers =
    s.svc === "local_move" && s.tier
      ? {
          [s.tier]: {
            price: preTax,
            total: incl(preTax),
            deposit: residentialTierDeposit(s.tier, preTax),
          },
        }
      : null;
  return {
    service_type: s.svc,
    move_date: moveDate,
    custom_price: preTax,
    deposit_amount: staleDeposit ?? storedDeposit(s, moveDate),
    tiers,
    selected_tier: s.tier ?? null,
  };
}

console.log("Payment parity suite\n====================");

for (const s of SERVICES) {
  for (const w of WINDOWS) {
    const moveDate = dateInDays(w.days);
    const taxIncl = incl(s.preTax);
    const clientCharge = calculateDeposit(s.svc, taxIncl, s.tier, moveDate);
    const quote = buildQuote(s, moveDate);
    const serverMin = serverMinRequired(quote);
    const tag = `${s.svc}${s.tier ? `/${s.tier}` : ""} $${s.preTax} · ${w.name}`;

    // PRIMARY invariant: what the client is told to pay clears the server gate.
    assert(
      clientCharge >= serverMin,
      `[banner] ${tag}: client charges $${clientCharge} but server requires ≥ $${serverMin}`,
    );
    // Never charge more than the grand total.
    assert(
      clientCharge <= taxIncl,
      `[overcharge] ${tag}: client $${clientCharge} exceeds total $${taxIncl}`,
    );
    assert(clientCharge > 0, `[zero] ${tag}: client charge is $${clientCharge}`);

    // Full-payment services must always charge the full total, at any window.
    if (isFullPaymentAtBookingService(s.svc)) {
      assert(
        clientCharge === taxIncl,
        `[fullsvc] ${tag}: client charges $${clientCharge}, full-payment service needs $${taxIncl}`,
      );
    }
    // Inside 48h or short-notice (<4d) → full payment for every service.
    if (w.days < 4) {
      assert(
        clientCharge === taxIncl,
        `[shortnotice] ${tag}: client charges $${clientCharge}, expected full $${taxIncl}`,
      );
    }
    // Event threshold: ≤ $2,500 tax-inclusive → full.
    if (s.svc === "event" && taxIncl <= EVENT_FULL_PAYMENT_UNDER) {
      assert(
        clientCharge === taxIncl,
        `[event-threshold] ${tag}: client charges $${clientCharge}, ≤$${EVENT_FULL_PAYMENT_UNDER} should be full $${taxIncl}`,
      );
    }
  }
}

// ── Hostile / stale deposit_amount (the Lydell / YG-30424 reproduction) ──
// A full-payment or residential quote with a stale partial deposit_amount baked
// into the row must STILL clear the gate: neither side may trust the stored
// value for these. This is the exact shape that produced the September banners.
for (const s of SERVICES) {
  if (!(isFullPaymentAtBookingService(s.svc) || s.svc === "local_move")) continue;
  const moveDate = dateInDays(10); // well outside the window — deposit territory
  const taxIncl = incl(s.preTax);
  const clientCharge = calculateDeposit(s.svc, taxIncl, s.tier, moveDate);
  const quote = buildQuote(s, moveDate, /* staleDeposit */ 1); // absurd stale value
  const serverMin = serverMinRequired(quote);
  const tag = `${s.svc}${s.tier ? `/${s.tier}` : ""} $${s.preTax} · stale deposit_amount=$1`;
  assert(
    clientCharge >= serverMin,
    `[stale] ${tag}: client $${clientCharge} < server min $${serverMin} (stored value leaked into the gate)`,
  );
}

// ── Report ──
console.log(`\n${passed} assertions passed, ${failures.length} failed.`);
if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error("  ✗ " + f);
  process.exit(1);
}
console.log("All payment parity checks passed.");
