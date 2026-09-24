/**
 * Luxury TRUE-margin floor — the enforced pricing rail.
 *
 * "True margin" is what the tier keeps after direct cost (labour + truck + fuel
 * + supplies), the day's overhead share, AND the claims reserve. The quote
 * engine used to only WARN when a tier landed below its floor; this module is
 * the single source of truth that lets the engine (and the admin UI) auto-bump
 * a tier up to the lowest price that actually hits the floor.
 *
 * Because the claims reserve scales with price (`price * claimsPct`), it belongs
 * in the denominator of the solve:
 *
 *   trueMargin = (price - directCost - ohShare - price*claimsPct) / price
 *   => price   = (directCost + ohShare) / (1 - floorFrac - claimsPct)
 *
 * The direct cost and overhead share are price-independent (they come from the
 * recommended crew/hours/truck), so the solve is stable.
 */

export type PricingConfigMap = Map<string, string> | Record<string, string>;

export type TrueMarginFloors = {
  essential: number;
  signature: number;
  estate: number;
};

/** Defaults mirror the luxury positioning the admin banner has always shown. */
export const DEFAULT_TRUE_MARGIN_FLOORS: TrueMarginFloors = {
  essential: 0.55,
  signature: 0.62,
  estate: 0.7,
};

function cfgRaw(config: PricingConfigMap, key: string): string | undefined {
  return config instanceof Map ? config.get(key) : (config as Record<string, string>)[key];
}

function cfgNum(config: PricingConfigMap, key: string, fallback: number): number {
  const raw = cfgRaw(config, key);
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Per-tier true-margin floor FRACTIONS (0..1) from platform config. Accepts a
 * value stored either as a percent (`55`) or a fraction (`0.55`).
 */
export function trueMarginFloorsFromConfig(config: PricingConfigMap): TrueMarginFloors {
  const read = (key: string, dflt: number): number => {
    const v = cfgNum(config, key, dflt);
    if (!(v > 0)) return dflt;
    return v > 1 ? v / 100 : v;
  };
  return {
    essential: read("true_margin_floor_essential", DEFAULT_TRUE_MARGIN_FLOORS.essential),
    signature: read("true_margin_floor_signature", DEFAULT_TRUE_MARGIN_FLOORS.signature),
    estate: read("true_margin_floor_estate", DEFAULT_TRUE_MARGIN_FLOORS.estate),
  };
}

/** Whether the engine should auto-bump to the floor. Defaults ON; the config
 *  key is the kill switch (set `false`/`0`/`off` to revert to warn-only). */
export function isTrueMarginFloorEnforced(config: PricingConfigMap): boolean {
  const raw = cfgRaw(config, "enforce_true_margin_floor");
  if (raw == null || raw === "") return true;
  const v = String(raw).trim().toLowerCase();
  return !(v === "false" || v === "0" || v === "off" || v === "no");
}

/**
 * Lowest price (rounded UP to `rounding`) that achieves the tier's true-margin
 * floor. Returns 0 when the solve is degenerate (floor + claims ≥ ~0.95, or no
 * cost), i.e. "no enforceable floor" — callers should treat 0 as "don't clamp".
 */
export function trueMarginFloorPrice(args: {
  directCost: number;
  ohShare: number;
  claimsPct: number;
  floorFrac: number;
  rounding: number;
}): number {
  const { directCost, ohShare, claimsPct, floorFrac, rounding } = args;
  const denom = 1 - floorFrac - claimsPct;
  const numer = directCost + ohShare;
  if (!(denom > 0.05) || !(numer > 0)) return 0;
  const r = rounding > 0 ? rounding : 1;
  return Math.ceil(numer / denom / r) * r;
}
