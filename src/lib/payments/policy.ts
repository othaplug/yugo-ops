/**
 * resolvePaymentPolicy — the single source of truth for "what to charge at
 * booking" across every surface (client, server, admin, email, PDF).
 *
 * Motivation. September 2026's "blind spot" refactor tightened the SERVER
 * (payments/process gained isFullPaymentAtBookingService + decideBookingPayment
 * enforcement) without updating the corresponding CLIENT deposit useMemo,
 * admin "First payment" tile, PDF fallbacks, or the platform_config JSON.
 * Every WG / specialty / single_item quote after Sept 15 was one stored-value
 * away from the "refresh the page" banner (YG-30428 / Lydell Rector).
 *
 * The 196-assertion parity suite at scripts/test-payment-parity.ts guards
 * client vs server drift by calling calculateDeposit directly. This helper
 * layers on top of calculateDeposit and returns a richer shape that display
 * surfaces (client checkout labels, admin "First payment" tile, email
 * confirmation, PDF invoice) can consume without recomputing anything:
 *
 *     { requiresFullPayment, reason, fullAmount, amountAtBooking,
 *       depositAmount, balanceAmount }
 *
 * Every branch here defers to calculateDeposit, so if the parity suite
 * passes for calculateDeposit it passes for this helper by construction.
 * The `reason` field is derived from calculateDeposit's own precedence,
 * making the decision path debuggable in logs.
 *
 * Stale quote.deposit_amount values are IGNORED here for compute-context.
 * The raw stored value stays available on the input for display-context
 * callers who explicitly want "what was quoted originally".
 */
import {
  calculateDeposit,
  daysUntilMove,
  isFullPaymentAtBookingService,
} from "@/app/quote/[quoteId]/quote-shared";
import { decideBookingPayment } from "@/lib/quotes/booking-payment-window";

export type PaymentPolicyReason =
  | "service_policy"
  | "short_notice_window"
  | "small_job_under_550"
  | "deposit_split";

export interface PaymentPolicy {
  /** True when the full amount must be collected at booking (no split). */
  requiresFullPayment: boolean;
  /** Why the policy resolved the way it did — for logs, admin display, telemetry. */
  reason: PaymentPolicyReason;
  /** Tax-inclusive grand total for this booking. */
  fullAmount: number;
  /** Tax-inclusive amount to charge at booking. Equals fullAmount when requiresFullPayment. */
  amountAtBooking: number;
  /** Tax-inclusive deposit component of amountAtBooking. Equals amountAtBooking on full-payment. */
  depositAmount: number;
  /** Tax-inclusive remaining balance owed after amountAtBooking. Zero on full-payment. */
  balanceAmount: number;
}

export interface PaymentPolicyInput {
  service_type: string | null | undefined;
  /** Tax-inclusive grand total. Required — the caller must have computed this already. */
  totalWithTax: number;
  move_date?: string | Date | null;
  /** Residential tier when known (drives tier-percentage deposit). */
  selected_tier?: string | null;
  recommended_tier?: string | null;
  /** Server-side callers pass true to add the 1h drift tolerance on the
   *  short-notice window check, mirroring decideBookingPayment(serverSide). */
  serverSide?: boolean;
}

/** Threshold parity mirror — must equal the small-job threshold in quote-shared.calculateDeposit. */
const SMALL_JOB_FULL_PAYMENT_UNDER = 550;
/** Same threshold decideBookingPayment defends against (default 48h + 1h drift). */
const SHORT_NOTICE_DAYS = 4;

/**
 * Resolve the full payment policy for a quote/booking in one shape.
 * Idempotent, no I/O — pure derivation from the input.
 */
export function resolvePaymentPolicy(input: PaymentPolicyInput): PaymentPolicy {
  const svc = String(input.service_type ?? "").trim();
  const fullAmount = Math.max(0, Number(input.totalWithTax) || 0);
  const tier = input.selected_tier ?? input.recommended_tier ?? undefined;
  const moveDateStr =
    typeof input.move_date === "string"
      ? input.move_date
      : input.move_date instanceof Date
        ? input.move_date.toISOString().slice(0, 10)
        : null;

  // Delegate to calculateDeposit — the parity-guarded primitive that the
  // server's payments/process route matches on. Its result is
  // tax-inclusive when passed a tax-inclusive total, which is the shape
  // every consumer of this helper wants.
  const chargeAtBooking = calculateDeposit(svc, fullAmount, tier, moveDateStr);

  // Detect WHY the primitive resolved to full-payment (for telemetry /
  // admin display / diagnostic UX). Precedence mirrors calculateDeposit's
  // own branch order at quote-shared.ts:518-527.
  const requiresFullPayment = chargeAtBooking >= fullAmount;
  let reason: PaymentPolicyReason;
  if (!requiresFullPayment) {
    reason = "deposit_split";
  } else if (isFullPaymentAtBookingService(svc)) {
    reason = "service_policy";
  } else if (fullAmount > 0 && fullAmount < SMALL_JOB_FULL_PAYMENT_UNDER) {
    reason = "small_job_under_550";
  } else if (daysUntilMove(moveDateStr) < SHORT_NOTICE_DAYS) {
    reason = "short_notice_window";
  } else {
    // The primitive collapsed to full payment for a service that isn't in
    // any of the named triggers (e.g. event ≤ EVENT_FULL_PAYMENT_UNDER).
    // Group under service_policy so downstream UX still shows "collected
    // in full at booking" without a misleading window / small-job label.
    reason = "service_policy";
  }

  // Also independently consult the window primitive so short-notice always
  // resolves to true even if calculateDeposit's own gate drifts in a
  // future edit — belt-and-suspenders, matching the parity suite's own
  // second-source cross-check.
  const windowDecision = decideBookingPayment({
    moveDate: moveDateStr,
    deposit: chargeAtBooking,
    grandTotal: fullAmount,
    serverSide: input.serverSide === true,
  });
  const effectivelyFull =
    requiresFullPayment || windowDecision.requireFullPayment;
  const effectiveCharge = effectivelyFull ? fullAmount : chargeAtBooking;
  const effectiveReason =
    windowDecision.requireFullPayment && !requiresFullPayment
      ? "short_notice_window"
      : reason;

  return {
    requiresFullPayment: effectivelyFull,
    reason: effectiveReason,
    fullAmount,
    amountAtBooking: effectiveCharge,
    depositAmount: effectiveCharge,
    balanceAmount: Math.max(0, fullAmount - effectiveCharge),
  };
}
