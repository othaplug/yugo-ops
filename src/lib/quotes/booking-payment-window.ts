/**
 * Booking payment timing — deposit vs. full payment.
 *
 * Background: quotes booked close to move day used to collect only the
 * deposit at booking, then rely on the daily T-2 auto-charge cron to
 * collect the balance. The cron looks at moves scheduled exactly 2-3 days
 * out, so anything booked inside the 48-hour window slipped through:
 * crew arrived on a move with only the deposit collected.
 *
 * Policy:
 *   - Move is in ≥ 48 hours → deposit at booking, balance auto-charged at T-2
 *   - Move is in <  48 hours → full payment required at booking
 *
 * The threshold is tunable via platform_config.booking_full_payment_window_hours
 * (default 48). Server enforces the check independently of the client so a
 * stale form can't bypass it.
 *
 * The contract already says deposit is non-refundable within 48h, so
 * pre-collecting the full balance just aligns billing with the refund
 * policy.
 */

export const DEFAULT_FULL_PAYMENT_WINDOW_HOURS = 48;
/** Tolerance for clock drift / round-trip latency between client and server. */
const CLIENT_SERVER_DRIFT_TOLERANCE_HOURS = 1;

export type BookingPaymentDecision = {
  /** True when the client must pay the full grand total at booking. */
  requireFullPayment: boolean;
  /** The amount the client should be charged (deposit or full total). */
  amountToCharge: number;
  /** Whole hours between now and move_date (rounded down). May be negative for past dates. */
  hoursUntilMove: number;
  /** Threshold actually applied (after reading config). */
  thresholdHours: number;
  /** Human-readable reason — used in admin logs and user-facing notes. */
  reason: "outside_window" | "inside_window" | "no_move_date";
};

export function hoursUntilMoveDate(
  moveDate: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!moveDate) return null;
  const target =
    typeof moveDate === "string"
      ? // Treat bare YYYY-MM-DD as start-of-day in client's local; if a full
        // ISO string is passed, use it as-is.
        moveDate.length === 10
        ? new Date(`${moveDate}T00:00:00`)
        : new Date(moveDate)
      : moveDate;
  if (Number.isNaN(target.getTime())) return null;
  const diffMs = target.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}

export function decideBookingPayment(input: {
  moveDate: string | Date | null | undefined;
  deposit: number;
  grandTotal: number;
  /** Override the default 48h (e.g. from platform_config). */
  windowHours?: number | null;
  /** When `true`, this is the server-side path and we add drift tolerance
   *  so the client doesn't get rejected by 30s of network latency. */
  serverSide?: boolean;
  now?: Date;
}): BookingPaymentDecision {
  const thresholdHours =
    typeof input.windowHours === "number" &&
    Number.isFinite(input.windowHours) &&
    input.windowHours > 0
      ? input.windowHours
      : DEFAULT_FULL_PAYMENT_WINDOW_HOURS;

  const hours = hoursUntilMoveDate(input.moveDate, input.now);
  if (hours == null) {
    return {
      requireFullPayment: false,
      amountToCharge: input.deposit,
      hoursUntilMove: 0,
      thresholdHours,
      reason: "no_move_date",
    };
  }

  const effectiveThreshold = input.serverSide
    ? thresholdHours - CLIENT_SERVER_DRIFT_TOLERANCE_HOURS
    : thresholdHours;

  if (hours < effectiveThreshold) {
    return {
      requireFullPayment: true,
      amountToCharge: input.grandTotal,
      hoursUntilMove: hours,
      thresholdHours,
      reason: "inside_window",
    };
  }
  return {
    requireFullPayment: false,
    amountToCharge: input.deposit,
    hoursUntilMove: hours,
    thresholdHours,
    reason: "outside_window",
  };
}
