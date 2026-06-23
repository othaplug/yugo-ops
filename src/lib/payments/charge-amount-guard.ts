/**
 * Runtime invariant: every Square charge for a stored entity (move balance,
 * statement balance, bin-order due, supplies total, etc.) must charge the
 * amount the client already saw, not a freshly recomputed one.
 *
 * Pattern that this guard prevents (MV-30228, Chidera Allison, 2026-06-22):
 *   - Quote engine bakes CC fee into the displayed balance: $528.
 *   - Voluntary payment endpoint recomputes a "ccTotal" = balance × 1.033 + 0.15.
 *   - Square is charged $545.57 instead of $528.
 *   - Client emails support: "why was I charged more than my balance?"
 *
 * Use this guard at every Square charge call site:
 *
 *   assertChargeMatchesStored({
 *     attemptedCents: Math.round(ccTotal * 100),
 *     storedCents: Math.round(move.balance_amount * 100),
 *     context: { move_code, source: "voluntary-balance-payment" },
 *   });
 *
 * The guard throws (server returns 500) if the amounts diverge by more than
 * a $0.05 rounding tolerance. The throw is intentional — silent drift is the
 * exact failure mode that hit production. Better to refuse the charge and
 * page an operator than to over-collect from a client.
 */

const ROUNDING_TOLERANCE_CENTS = 5; // $0.05

export class ChargeAmountMismatchError extends Error {
  constructor(
    public attemptedCents: number,
    public storedCents: number,
    public context: Record<string, unknown>,
  ) {
    const delta = attemptedCents - storedCents;
    const deltaDollars = (delta / 100).toFixed(2);
    super(
      `Charge amount mismatch: attempted $${(attemptedCents / 100).toFixed(2)} ` +
        `vs stored $${(storedCents / 100).toFixed(2)} (delta $${deltaDollars}). ` +
        `Context: ${JSON.stringify(context)}. Refusing to charge.`,
    );
    this.name = "ChargeAmountMismatchError";
  }
}

export function assertChargeMatchesStored(opts: {
  attemptedCents: number;
  storedCents: number;
  context: Record<string, unknown>;
}): void {
  const delta = Math.abs(opts.attemptedCents - opts.storedCents);
  if (delta > ROUNDING_TOLERANCE_CENTS) {
    // Throw — every caller wraps Square.payments.create in try/catch and
    // returns a 500 / structured error. Better to fail loud than over-collect.
    throw new ChargeAmountMismatchError(
      opts.attemptedCents,
      opts.storedCents,
      opts.context,
    );
  }
}
