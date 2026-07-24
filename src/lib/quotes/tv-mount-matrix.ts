/**
 * TV wall-mount add-on — variant matrix helpers.
 *
 * The full pricing grid lives in DB (`addons.variant_config` for the
 * `tv_mounting` slug); this file is the typed shape + free-typed size →
 * band derivation + safe lookup used by the picker, the quote engine,
 * and the client display. Keeping the type + math in one place stops
 * the three surfaces from drifting.
 */

export type TVMountSizeBand = "32-42" | "43-55" | "56-65" | "66-75" | "76-85";
export type TVMountType = "fixed" | "tilt" | "full_motion";

export const TV_MOUNT_SIZE_BANDS: readonly TVMountSizeBand[] = [
  "32-42",
  "43-55",
  "56-65",
  "66-75",
  "76-85",
] as const;

export const TV_MOUNT_TYPES: readonly TVMountType[] = [
  "fixed",
  "tilt",
  "full_motion",
] as const;

export interface TVMountVariantCell {
  mount_model: string;
  labour_minutes: number;
  price: number;
}

export interface TVMountVariantSize {
  label: string;
  requires_two_installers: boolean;
  types: Record<TVMountType, TVMountVariantCell>;
}

export interface TVMountVariantConfig {
  sizes: Record<TVMountSizeBand, TVMountVariantSize>;
  type_labels: Record<TVMountType, string>;
  type_descriptions: Record<TVMountType, string>;
  included: string[];
  not_included: string[];
  min_size_inches: number;
  max_size_inches: number;
}

/** Free-typed inches → band. Returns null outside 32-85 range. */
export function getTVSizeBand(inches: number): TVMountSizeBand | null {
  if (!Number.isFinite(inches)) return null;
  if (inches < 32 || inches > 85) return null;
  if (inches <= 42) return "32-42";
  if (inches <= 55) return "43-55";
  if (inches <= 65) return "56-65";
  if (inches <= 75) return "66-75";
  return "76-85";
}

/**
 * Safe lookup — returns null when the config, band, or type is missing,
 * so callers can render a 0-priced placeholder instead of crashing.
 */
export function lookupTVMountCell(
  config: TVMountVariantConfig | null | undefined,
  band: TVMountSizeBand,
  type: TVMountType,
): TVMountVariantCell | null {
  const sizeCell = config?.sizes?.[band];
  const typeCell = sizeCell?.types?.[type];
  if (!typeCell) return null;
  return typeCell;
}

/** Runtime shape guard — coerces an unknown row into the typed config or null. */
export function coerceTVMountVariantConfig(
  raw: unknown,
): TVMountVariantConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!r.sizes || typeof r.sizes !== "object") return null;
  return r as unknown as TVMountVariantConfig;
}
