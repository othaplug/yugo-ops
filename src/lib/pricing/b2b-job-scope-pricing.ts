/**
 * B2B job-scope surcharges — single source of truth.
 *
 * The B2B one-off builder (JobScopeSection) lets a coordinator pick how much of
 * the logistics chain Yugo owns:
 *
 *   direct_delivery      Yugo delivers only. No scope surcharge.
 *   receive_and_deliver  Yugo receives the inbound crate at the warehouse from a
 *                        3rd-party carrier, stages/inspects it, then delivers.
 *                        Adds a flat receiving/handling fee.
 *   receive_and_recover  Full swap: deliver the new item, recover the customer's
 *                        original, and return it to the warehouse for partner
 *                        pickup. Adds the receiving fee PLUS a recover uplift for
 *                        the reverse leg (return trip, load-out, warehouse intake).
 *
 * Applied identically by the live client estimate (B2BJobsDeliveryForm), the
 * pricing-preview route, and /api/quotes/generate so the number never drifts
 * between the estimate, the sent quote, and the created delivery.
 *
 * Both amounts are config-overridable via platform_config so pricing can be
 * retuned without a code change; the defaults below are the fallbacks.
 */

export type JobScope =
  | "direct_delivery"
  | "receive_and_deliver"
  | "receive_and_recover";

/** Fraction of the delivery base (pre-recovery subtotal) charged for the reverse
 *  recover leg. platform_config key: b2b_recover_uplift_pct. */
export const B2B_RECOVER_UPLIFT_PCT_DEFAULT = 0.5;

/** Flat warehouse receiving/handling fee (CAD, pre-tax) for any scope that takes
 *  in an inbound shipment. platform_config key: b2b_receiving_fee. */
export const B2B_RECEIVING_FEE_DEFAULT = 75;

export function isValidJobScope(v: unknown): v is JobScope {
  return (
    v === "direct_delivery" ||
    v === "receive_and_deliver" ||
    v === "receive_and_recover"
  );
}

/** True when the scope takes in an inbound shipment (warehouse receipt). */
export function scopeRequiresInbound(scope: JobScope): boolean {
  return scope === "receive_and_deliver" || scope === "receive_and_recover";
}

export type JobScopeSurchargeLine = { label: string; amount: number };

export type JobScopeSurcharge = {
  /** Pre-tax dollars to add to the delivery subtotal (before processing recovery). */
  addPreTax: number;
  /** Human-readable breakdown lines to append to the price breakdown. */
  lines: JobScopeSurchargeLine[];
};

export type JobScopeRates = {
  recoverUpliftPct?: number;
  receivingFee?: number;
};

/**
 * Compute the scope surcharge for a job.
 *
 * @param scope             the selected job scope
 * @param deliveryBasePreTax the delivery's own pre-tax subtotal (pre-recovery),
 *                           used as the base for the percentage recover uplift
 * @param rates             optional config overrides
 */
export function computeJobScopeSurcharge(
  scope: JobScope,
  deliveryBasePreTax: number,
  rates: JobScopeRates = {},
): JobScopeSurcharge {
  const lines: JobScopeSurchargeLine[] = [];
  let addPreTax = 0;

  if (scope === "direct_delivery") {
    return { addPreTax: 0, lines: [] };
  }

  const receivingFee = Math.max(
    0,
    rates.receivingFee ?? B2B_RECEIVING_FEE_DEFAULT,
  );
  if (scopeRequiresInbound(scope) && receivingFee > 0) {
    addPreTax += receivingFee;
    lines.push({
      label: "Warehouse receiving and handling",
      amount: receivingFee,
    });
  }

  if (scope === "receive_and_recover") {
    const pct = Math.max(0, rates.recoverUpliftPct ?? B2B_RECOVER_UPLIFT_PCT_DEFAULT);
    const uplift = Math.round(Math.max(0, deliveryBasePreTax) * pct);
    if (uplift > 0) {
      addPreTax += uplift;
      lines.push({
        label: "Recover original and return to warehouse",
        amount: uplift,
      });
    }
  }

  return { addPreTax, lines };
}
