/**
 * Payroll burden + loaded crew rate calculator.
 *
 * Replaces the hardcoded $28/mover-hour "loaded" rate with a derived
 * calculation from explicit base wages + payroll burden rates. This
 * makes the labour cost in the per-job direct-cost stack auditable
 * end-to-end:
 *
 *   wage_per_hour × (1 + CPP + EI + WSIB + vacation + EHT) = loaded
 *
 * All inputs are configurable via platform_config so the operator
 * can update for annual rate changes (CPP / EI / WSIB) or
 * negotiate wage increases without code changes.
 *
 * Verified 2026 Ontario rates (citations baked in):
 *   - CPP employer:    5.95% on pensionable $3,500 – $73,200 YMPE
 *                      (CRA, 2026 contribution rates schedule)
 *   - EI employer:     2.296% (= 1.4 × employee rate 1.64%) on
 *                      insurable earnings up to $65,700
 *   - WSIB Ontario:    1.23% per $100 average for 2026
 *                      (WSIB premium rate schedule, eff. Jan 1 2026).
 *                      NB: moving industry (NAICS 484) carries a
 *                      higher rate group, typically 3-5%. Default
 *                      below uses the average; operator should set
 *                      the actual class-G rate via config.
 *   - Vacation pay:    4.00% statutory minimum per Ontario ESA
 *                      (bumps to 6% after 5 years service)
 *   - EHT:             0% under small-business $1M payroll
 *                      exemption (1.95% above; configurable)
 *
 * Total burden multiplier at defaults: 1.13476
 * I.e. a $22/hr mover costs the business $22 × 1.13476 = $24.96/hr
 */

export interface PayrollBurdenConfig {
  cpp_pct?: number;
  ei_pct?: number;
  wsib_pct?: number;
  vacation_pct?: number;
  eht_pct?: number;
}

export interface CrewWageConfig {
  mover_wage?: number;
  driver_wage?: number;
  lead_wage?: number;
}

/** Verified 2026 Ontario defaults — used when platform_config keys are unset. */
export const DEFAULT_PAYROLL_BURDEN: Required<PayrollBurdenConfig> = {
  cpp_pct: 0.0595,
  ei_pct: 0.02296,
  wsib_pct: 0.0123,
  vacation_pct: 0.04,
  eht_pct: 0,
};

/** Default base wages for a luxury Toronto moving operation. */
export const DEFAULT_CREW_WAGES: Required<CrewWageConfig> = {
  mover_wage: 22,
  driver_wage: 25,
  lead_wage: 28,
};

/**
 * Typical 4-person residential crew composition. Used to compute the
 * weighted-average loaded rate that the engine applies as a single
 * cost-per-mover-hour figure at quote time (when the actual crew
 * composition isn't known yet).
 */
export const TYPICAL_CREW_COMPOSITION = {
  movers: 2,
  drivers: 1,
  leads: 1,
} as const;

/** Read a config value, treating explicit 0 as 0 (not falsy → fallback). */
function readNum(
  config: Record<string, string> | undefined,
  key: string,
  fallback: number,
): number {
  if (!config) return fallback;
  const raw = config[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getPayrollBurdenConfig(
  config: Record<string, string> | undefined,
): Required<PayrollBurdenConfig> {
  return {
    cpp_pct: readNum(config, "payroll_burden_cpp_pct", DEFAULT_PAYROLL_BURDEN.cpp_pct),
    ei_pct: readNum(config, "payroll_burden_ei_pct", DEFAULT_PAYROLL_BURDEN.ei_pct),
    wsib_pct: readNum(config, "payroll_burden_wsib_pct", DEFAULT_PAYROLL_BURDEN.wsib_pct),
    vacation_pct: readNum(config, "payroll_burden_vacation_pct", DEFAULT_PAYROLL_BURDEN.vacation_pct),
    eht_pct: readNum(config, "payroll_burden_eht_pct", DEFAULT_PAYROLL_BURDEN.eht_pct),
  };
}

export function getCrewWageConfig(
  config: Record<string, string> | undefined,
): Required<CrewWageConfig> {
  return {
    mover_wage: readNum(config, "crew_pay_rate_mover", DEFAULT_CREW_WAGES.mover_wage),
    driver_wage: readNum(config, "crew_pay_rate_driver", DEFAULT_CREW_WAGES.driver_wage),
    lead_wage: readNum(config, "crew_pay_rate_lead", DEFAULT_CREW_WAGES.lead_wage),
  };
}

/** Sum of all payroll burden rates. */
export function computeBurdenSum(burden: Required<PayrollBurdenConfig>): number {
  return (
    burden.cpp_pct +
    burden.ei_pct +
    burden.wsib_pct +
    burden.vacation_pct +
    burden.eht_pct
  );
}

/** Loaded rate from a base wage and burden config. */
export function computeLoadedRate(
  baseWage: number,
  burden: Required<PayrollBurdenConfig>,
): number {
  const multiplier = 1 + computeBurdenSum(burden);
  return Math.round(baseWage * multiplier * 100) / 100;
}

export interface RoleLoadedRates {
  mover: number;
  driver: number;
  lead: number;
  burdenMultiplier: number;
  burdenSum: number;
}

/** Per-role loaded rates given the current config. */
export function getRoleLoadedRates(
  config: Record<string, string> | undefined,
): RoleLoadedRates {
  const wages = getCrewWageConfig(config);
  const burden = getPayrollBurdenConfig(config);
  const burdenSum = computeBurdenSum(burden);
  const multiplier = 1 + burdenSum;
  return {
    mover: Math.round(wages.mover_wage * multiplier * 100) / 100,
    driver: Math.round(wages.driver_wage * multiplier * 100) / 100,
    lead: Math.round(wages.lead_wage * multiplier * 100) / 100,
    burdenMultiplier: multiplier,
    burdenSum,
  };
}

/**
 * Weighted-average loaded crew rate for the typical 4-person crew.
 * This is the single $/mover-hour figure used at quote time when the
 * specific crew composition isn't known. Operators with crew sizes >
 * or < 4 still get reasonable cost estimates because the ratio of
 * movers : drivers : leads stays approximately the same across crew
 * sizes (leads + driver are typically 1 each regardless).
 */
export function getAverageCrewLoadedRate(
  config: Record<string, string> | undefined,
): number {
  const rates = getRoleLoadedRates(config);
  const c = TYPICAL_CREW_COMPOSITION;
  const total = rates.mover * c.movers + rates.driver * c.drivers + rates.lead * c.leads;
  const headcount = c.movers + c.drivers + c.leads;
  return Math.round((total / headcount) * 100) / 100;
}
