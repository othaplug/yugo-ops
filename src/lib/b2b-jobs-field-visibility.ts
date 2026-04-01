/**
 * Reads `delivery_verticals.default_config.field_visibility` (seeded via migration / admin).
 * When `show` is non-empty, only listed feature keys are shown (after applying `hide`).
 * When `show` is empty/omitted, all keys except those in `hide` are shown.
 *
 * Legacy: `show` may include `complexity` — expands to debris, stairs, high value, artwork, antiques.
 */
const COMPLEXITY_LEGACY_EXPAND = new Set([
  "debris_removal",
  "stairs",
  "high_value",
  "artwork",
  "antiques",
]);

export type B2BJobsFieldVisibility = {
  show?: string[];
  hide?: string[];
  defaultHandling?: string;
  defaultCrew?: number;
  multiStopDefault?: boolean;
};

export function parseB2BJobsFieldVisibility(
  defaultConfig: Record<string, unknown> | null | undefined,
): B2BJobsFieldVisibility | null {
  if (!defaultConfig || typeof defaultConfig !== "object") return null;
  const fv = defaultConfig.field_visibility;
  if (!fv || typeof fv !== "object" || Array.isArray(fv)) return null;
  const o = fv as Record<string, unknown>;
  return {
    show: Array.isArray(o.show) ? o.show.filter((x): x is string => typeof x === "string") : undefined,
    hide: Array.isArray(o.hide) ? o.hide.filter((x): x is string => typeof x === "string") : undefined,
    defaultHandling: typeof o.defaultHandling === "string" ? o.defaultHandling : undefined,
    defaultCrew: typeof o.defaultCrew === "number" && Number.isFinite(o.defaultCrew) ? o.defaultCrew : undefined,
    multiStopDefault: typeof o.multiStopDefault === "boolean" ? o.multiStopDefault : undefined,
  };
}

/** Admin JSON may use `hookup_install`; the form uses `hookup`. */
function hideBlocksHookup(hide: string[] | undefined): boolean {
  return !!(hide?.includes("hookup") || hide?.includes("hookup_install"));
}

function showAllowsHookup(show: string[] | undefined): boolean {
  return !!(show?.includes("hookup") || show?.includes("hookup_install"));
}

/** Returns whether a feature key (e.g. `skid_count`, `multi_stop`) should appear in the B2B Jobs form. */
export function b2bJobsFieldVisible(fv: B2BJobsFieldVisibility | null, key: string): boolean {
  if (!fv) return true;
  const hide = fv.hide ?? [];
  if (hide.includes(key)) return false;
  if (key === "hookup" && hideBlocksHookup(hide) && !hide.includes("hookup")) return false;

  if (fv.show && fv.show.length > 0) {
    if (fv.show.includes(key)) return true;
    if (key === "hookup" && showAllowsHookup(fv.show)) return true;
    if (fv.show.includes("complexity") && COMPLEXITY_LEGACY_EXPAND.has(key)) return true;
    return false;
  }
  return true;
}
