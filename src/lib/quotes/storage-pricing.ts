/**
 * Secure storage add-on pricing.
 *
 * Yugo offers full-service storage-in-transit (crew loads it into our facility,
 * palletized + climate-controlled + insured, then redelivers). It's billed
 * PER WEEK and the weekly rate scales with the move size. The client picks the
 * number of weeks (the add-on quantity).
 *
 * Rates positioned at the premium end of the Toronto storage-in-transit band
 * ($150–600+/mo); see research 2026-06. The add-on row in the DB carries a
 * placeholder price — the size-based rate below is the source of truth and is
 * injected wherever the add-on is priced (engine, client quote, admin form).
 */

/** Slug of the storage add-on row in the `addons` table. */
export const STORAGE_ADDON_SLUG = "secure_storage";

/** Max weeks a client can select for storage (1–12). */
export const STORAGE_MAX_WEEKS = 12;

/** Per-week storage rate by move size. Keys match the engine's move_size values. */
const STORAGE_WEEKLY_RATE_BY_SIZE: Record<string, number> = {
  studio: 50,
  partial: 50,
  "1br": 65,
  "1_bedroom": 65,
  "2br": 95,
  "2_bedroom": 95,
  "3br": 135,
  "3_bedroom": 135,
  "4br": 175,
  "4_bedroom": 175,
  "5br": 225,
  "5br_plus": 225,
  "5_bedroom": 225,
};

/** Default when move size is unknown — the 1BR rate (most common). */
const STORAGE_DEFAULT_WEEKLY_RATE = 65;

/** Single-item moves have no bedroom size — flat rate for storing one piece. */
const STORAGE_SINGLE_ITEM_WEEKLY_RATE = 35;

/**
 * Resolve the per-week storage rate. Single-item moves use a flat rate (one
 * piece, no bedroom size); everything else scales by move size.
 */
export function storageWeeklyRate(
  moveSize?: string | null,
  serviceType?: string | null,
): number {
  if ((serviceType || "").toLowerCase() === "single_item") {
    return STORAGE_SINGLE_ITEM_WEEKLY_RATE;
  }
  const key = (moveSize || "").toLowerCase().trim();
  return STORAGE_WEEKLY_RATE_BY_SIZE[key] ?? STORAGE_DEFAULT_WEEKLY_RATE;
}

/** Clamp a requested week count to the allowed 1–STORAGE_MAX_WEEKS range. */
export function clampStorageWeeks(weeks: number): number {
  if (!Number.isFinite(weeks) || weeks < 1) return 1;
  return Math.min(STORAGE_MAX_WEEKS, Math.floor(weeks));
}

/**
 * Return a copy of an add-on row with its per-week price set to the size-based
 * storage rate. No-op for any add-on that isn't the storage add-on. Used so the
 * client quote page + admin form display and price storage at the correct rate.
 */
export function withStorageWeeklyPrice<
  T extends { slug?: string | null; price?: number | null },
>(addon: T, moveSize?: string | null, serviceType?: string | null): T {
  if ((addon.slug || "") !== STORAGE_ADDON_SLUG) return addon;
  return { ...addon, price: storageWeeklyRate(moveSize, serviceType) };
}
