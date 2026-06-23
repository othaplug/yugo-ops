/**
 * CC processing recovery — the single source of truth for grossing up a
 * pre-tax price so the displayed amount already covers Yugo's card-processor
 * cost (default 2.9% + $0.30 per Square's standard rate; configurable via
 * platform_config keys processing_recovery_rate and processing_recovery_flat).
 *
 * Every client-facing quote, range, surcharge, or admin-entered scope charge
 * must flow through one of these helpers. The math:
 *
 *   gross = ceil((preTax + procFlat) / (1 - procRate))
 *   rounded = nearest(gross, rounding)
 *
 * After rounding the merchant nets approximately the input price once Square
 * takes its per-transaction cut. The client never sees a separate fee line —
 * the absorption is silent. At payment time, every charge endpoint takes the
 * already-baked amount and never adds a surcharge on top.
 *
 * Previous bug (MV-30228, Chidera Allison, 2026-06-22): two voluntary
 * payment endpoints added a 3.3% + $0.15 surcharge at charge time on top of
 * an already-baked balance. Total charged was $545.57 vs the displayed $528.
 * Fix removed the surcharge AND centralized this helper so no quote path can
 * silently underbid the processor cost.
 */

type ConfigLike =
  | Map<string, string>
  | Record<string, string | number | null | undefined>;

function configGet(config: ConfigLike, key: string): string | undefined {
  if (config instanceof Map) return config.get(key);
  const v = (config as Record<string, unknown>)[key];
  return v === null || v === undefined ? undefined : String(v);
}

function configNumber(config: ConfigLike, key: string, fallback: number): number {
  const v = configGet(config, key);
  return v !== undefined ? Number(v) : fallback;
}

/** Default recovery params — match what's seeded in platform_config. */
export const PROCESSING_RECOVERY_DEFAULT_RATE = 0.029;
export const PROCESSING_RECOVERY_DEFAULT_FLAT = 0.30;

/**
 * Gross up a pre-tax dollar amount by the configured processing-recovery rate.
 * Returns the grossed-up unrounded price. Use the rounded variant below for
 * client-facing quote prices; this raw form is for compounding inside a
 * breakdown before a single final round.
 */
export function grossUpForProcessing(
  preTaxPrice: number,
  config: ConfigLike,
): number {
  const procRate = configNumber(config, "processing_recovery_rate", PROCESSING_RECOVERY_DEFAULT_RATE);
  const procFlat = configNumber(config, "processing_recovery_flat", PROCESSING_RECOVERY_DEFAULT_FLAT);
  return Math.ceil((preTaxPrice + procFlat) / (1 - procRate));
}

/**
 * Apply processing recovery + round to a clean tier-style number. Use this
 * for any client-facing quoted price (residential tiers handle this inline
 * inside the quote engine; everything else funnels through this helper).
 */
export function applyProcessingRecoveryAndRound(
  preTaxPrice: number,
  config: ConfigLike,
  roundingNearest = 50,
): number {
  const grossed = grossUpForProcessing(preTaxPrice, config);
  return Math.round(grossed / roundingNearest) * roundingNearest;
}

/** TierResult-shaped return: gross up the price, recompute tax + total. */
export function applyProcessingRecoveryToTier<
  T extends { price: number; tax?: number; total?: number; deposit?: number },
>(t: T, config: ConfigLike, roundingNearest = 50): T {
  const taxRate = configNumber(config, "tax_rate", 0.13);
  const rounded = applyProcessingRecoveryAndRound(t.price, config, roundingNearest);
  const tax = Math.round(rounded * taxRate);
  // Fix 1+2 (2026-06-24): when deposit was "full" (== pre-recovery price) the
  // deposit must scale with the gross-up — otherwise the displayed deposit
  // stays at the pre-recovery number while the total moves up and the client
  // sees inconsistent figures (YG-30311: $850 deposit on a $1,017 total).
  // When deposit is "full", we now lift it to the tax-INCLUSIVE total so the
  // quote presentation can label it as "Pay in full" without the client
  // doing math themselves.
  const oldPrice = t.price;
  const oldDeposit = t.deposit ?? 0;
  const wasFullDeposit =
    oldPrice > 0 && Math.abs(oldDeposit - oldPrice) < 1; // within $1
  const newDeposit = wasFullDeposit ? rounded + tax : oldDeposit;
  return { ...t, price: rounded, tax, total: rounded + tax, deposit: newDeposit };
}
