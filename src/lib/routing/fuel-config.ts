/** platform_config keys for navigation / per-move fuel estimates (CAD per litre). */
export const KEY_FUEL_GAS = "fuel_price_gas_cad_per_litre";
export const KEY_FUEL_DIESEL = "fuel_price_diesel_cad_per_litre";
/** `gas` or `diesel` — which litre price applies to crew nav, dispatch route labels, and move fuel logging. */
export const KEY_NAV_FUEL_TYPE = "navigation_fuel_type";

export const NAV_FUEL_KEYS = [KEY_FUEL_GAS, KEY_FUEL_DIESEL, KEY_NAV_FUEL_TYPE] as const;

export const DEFAULT_FUEL_PRICE_GAS = 1.65;
export const DEFAULT_FUEL_PRICE_DIESEL = 1.85;

export function cfgFuelNum(config: Record<string, string>, key: string, fallback: number): number {
  const v = config[key];
  if (v == null || String(v).trim() === "") return fallback;
  const n = parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Resolves $/L used for L/100km-based fuel cost (navigation UI + `moves.estimated_fuel_cost`). */
export function resolveNavigationFuelPriceCadPerLitre(config: Record<string, string>): number {
  const t = (config[KEY_NAV_FUEL_TYPE] || "gas").toLowerCase().trim();
  if (t === "diesel") {
    return cfgFuelNum(config, KEY_FUEL_DIESEL, DEFAULT_FUEL_PRICE_DIESEL);
  }
  return cfgFuelNum(config, KEY_FUEL_GAS, DEFAULT_FUEL_PRICE_GAS);
}

export function buildFuelConfigMap(rows: { key: string; value: string | null }[] | null | undefined): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of rows ?? []) {
    if (r?.key) m[r.key] = r.value ?? "";
  }
  return m;
}
