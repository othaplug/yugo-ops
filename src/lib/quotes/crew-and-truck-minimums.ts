/**
 * Hard truck + crew minimums by move size.
 *
 * These are NOT recommendations — they are floors enforced by the
 * pricing engine, the Estate schedule generator, the client quote
 * display, and the admin override form. A coordinator can override
 * UP (assign a larger truck or more crew) but cannot override DOWN
 * without the engine silently flooring back to the minimum.
 *
 * Rationale (from operator audit, 2026-05):
 *   - A Sprinter (~270 cuft) physically cannot move a 3BR home. If
 *     the engine wrote truck_primary='sprinter' to a 3BR quote and
 *     the client booked, the truck wouldn't fit the contents on move
 *     day. We had a near-miss like this. Hard floor: 3BR = 24ft min.
 *   - A 2-person crew on a 3BR move can't physically execute in a
 *     reasonable day. Operationally we need 4. Hard floor: 3BR move
 *     day = 4 movers, pack day = 3 packers.
 *
 * One source of truth so every consumer agrees:
 *   - /api/quotes/generate/route.ts (engine recommendation)
 *   - /src/lib/quotes/estate-schedule.ts (Estate per-day crew + truck)
 *   - /src/app/quote/[quoteId]/QuotePageClient.tsx (display safety net)
 *   - /src/app/admin/quotes/new/QuoteFormClient.tsx (override warnings)
 */

import { displayLabel } from "@/lib/displayLabels";

export type TruckKey = "sprinter" | "16ft" | "20ft" | "24ft" | "26ft";

/**
 * Minimum truck size — engine and display floor any recommendation
 * that goes below this for the move size. Studio / partial / 1BR all
 * run on the extended Sprinter van (operator decision 2026-05) — the
 * "sprinter" key here is what surfaces in the UI as "Extended Sprinter
 * van" (see TRUCK_LUXURY in QuotePageClient.tsx).
 */
export const TRUCK_MINIMUMS: Record<string, TruckKey> = {
  studio: "sprinter",
  partial: "sprinter",
  "1br": "sprinter",
  // 2BR floor lowered to sprinter (2026-06-11) — light 2BRs fit in the
  // Sprinter cargo van (~400 cu ft) and the operator prefers running
  // the owned vehicle on every job we can. Heavier 2BRs still get
  // bumped up via the score-based recommender (see
  // recommendedTruckFromInventoryScore in generate/route.ts).
  "2br": "sprinter",
  "3br": "24ft",
  "4br": "24ft",
  "5br_plus": "26ft",
};

/** Recommended truck — what the engine should default to absent other signals. */
export const TRUCK_RECOMMENDATIONS: Record<string, TruckKey> = {
  studio: "sprinter",
  partial: "sprinter",
  "1br": "sprinter",
  "2br": "20ft",
  "3br": "24ft",
  "4br": "26ft",
  "5br_plus": "26ft",
};

/** Minimum movers (move-day crew). */
export const MOVER_MINIMUMS: Record<string, number> = {
  studio: 2,
  partial: 2,
  "1br": 2,
  "2br": 2,
  "3br": 4,
  "4br": 4,
  "5br_plus": 5,
};

/** Minimum packers (pack-day crew). Pack day is lighter than move day. */
export const PACKER_MINIMUMS: Record<string, number> = {
  studio: 2,
  partial: 2,
  "1br": 2,
  "2br": 2,
  "3br": 3,
  "4br": 4,
  "5br_plus": 4,
};

/** Ranking — higher index = larger truck. */
export const TRUCK_SIZE_RANK: readonly TruckKey[] = [
  "sprinter",
  "16ft",
  "20ft",
  "24ft",
  "26ft",
] as const;

const normMoveSize = (raw: string | null | undefined): string =>
  String(raw ?? "").toLowerCase().trim();

export function getTruckMinimum(moveSize: string | null | undefined): TruckKey {
  return TRUCK_MINIMUMS[normMoveSize(moveSize)] ?? "16ft";
}

export function getTruckRecommendation(
  moveSize: string | null | undefined,
): TruckKey {
  return TRUCK_RECOMMENDATIONS[normMoveSize(moveSize)] ?? "16ft";
}

export function getMoverMinimum(moveSize: string | null | undefined): number {
  return MOVER_MINIMUMS[normMoveSize(moveSize)] ?? 2;
}

export function getPackerMinimum(moveSize: string | null | undefined): number {
  return PACKER_MINIMUMS[normMoveSize(moveSize)] ?? 2;
}

/**
 * Rank a truck string. Exact rank keys map to their index. Free-form
 * recommendations larger than a single 26ft truck — e.g. the labour
 * estimator's "26ft + trailer or 2 trucks" for score > 95 — rank ABOVE
 * the top of TRUCK_SIZE_RANK so they are never treated as "unknown".
 * Returns -1 only when nothing recognisable is found.
 */
export function truckRankIndex(truck: string | null | undefined): number {
  if (!truck) return -1;
  const exact = (TRUCK_SIZE_RANK as readonly string[]).indexOf(truck);
  if (exact !== -1) return exact;
  const t = truck.toLowerCase();
  // A trailer or a second truck is above the largest single truck we rank.
  if (t.includes("trailer") || t.includes("2 truck") || t.includes("two truck")) {
    return TRUCK_SIZE_RANK.length; // > 26ft
  }
  // Fall back to the largest tier named anywhere in a free-form string.
  if (t.includes("26")) return TRUCK_SIZE_RANK.indexOf("26ft");
  if (t.includes("24")) return TRUCK_SIZE_RANK.indexOf("24ft");
  if (t.includes("20")) return TRUCK_SIZE_RANK.indexOf("20ft");
  if (t.includes("16")) return TRUCK_SIZE_RANK.indexOf("16ft");
  if (t.includes("sprinter")) return 0;
  return -1;
}

/**
 * Floor a truck pick to the minimum for the move size. If the pick is
 * already >= the floor, returns it unchanged. If smaller / unknown,
 * returns the floor.
 *
 * NOTE: previously this only matched exact rank keys, so a recommendation
 * like "26ft + trailer or 2 trucks" (emitted by estimateLabourFromScore
 * once the inventory score crosses 95) was treated as unknown and silently
 * DOWNGRADED to the move-size floor — e.g. a 4BR's "26ft + trailer" became
 * "24ft". That made the displayed truck SHRINK as items were added past the
 * 95-point threshold. truckRankIndex now ranks the trailer tier above 26ft
 * so an above-floor recommendation is kept as-is instead of being floored.
 */
export function floorTruckByMoveSize(
  truck: TruckKey | string | null | undefined,
  moveSize: string | null | undefined,
): TruckKey {
  const floor = getTruckMinimum(moveSize);
  const floorIdx = TRUCK_SIZE_RANK.indexOf(floor);
  const truckIdx = truckRankIndex(truck as string | null | undefined);
  if (truckIdx === -1 || truckIdx < floorIdx) return floor;
  return truck as TruckKey;
}

/** Floor a mover-count pick to the move-day minimum. */
export function floorMoversByMoveSize(
  movers: number | null | undefined,
  moveSize: string | null | undefined,
): number {
  const floor = getMoverMinimum(moveSize);
  const n = typeof movers === "number" && Number.isFinite(movers) ? Math.round(movers) : 0;
  return Math.max(floor, n);
}

/** Floor a packer-count pick to the pack-day minimum. */
export function floorPackersByMoveSize(
  packers: number | null | undefined,
  moveSize: string | null | undefined,
): number {
  const floor = getPackerMinimum(moveSize);
  const n = typeof packers === "number" && Number.isFinite(packers) ? Math.round(packers) : 0;
  return Math.max(floor, n);
}

/**
 * Validate a coordinator's truck override against the move-size floor.
 * Used by the admin form to surface a red warning when the coordinator
 * tries to pick a smaller truck than the move physically requires.
 */
export function validateTruckSelection(
  selectedTruck: TruckKey | string | null | undefined,
  moveSize: string | null | undefined,
): { valid: boolean; minimumRequired: TruckKey; message?: string } {
  const minimumRequired = getTruckMinimum(moveSize);
  if (!selectedTruck) return { valid: true, minimumRequired };
  const floorIdx = TRUCK_SIZE_RANK.indexOf(minimumRequired);
  const selIdx =
    (TRUCK_SIZE_RANK as readonly string[]).includes(selectedTruck as string)
      ? TRUCK_SIZE_RANK.indexOf(selectedTruck as TruckKey)
      : -1;
  if (selIdx === -1 || selIdx < floorIdx) {
    return {
      valid: false,
      minimumRequired,
      message: `${displayLabel(String(moveSize ?? ""))} moves require at least a ${minimumRequired} truck. "${selectedTruck}" is below this floor and will be overridden to ${minimumRequired} on save.`,
    };
  }
  return { valid: true, minimumRequired };
}

/**
 * Validate a coordinator's crew override against the move-size floor.
 * dayType determines whether to check movers or packers.
 */
export function validateCrewSize(
  selectedCrew: number | null | undefined,
  moveSize: string | null | undefined,
  dayType: "move" | "pack",
): { valid: boolean; minimumRequired: number; message?: string } {
  const minimumRequired =
    dayType === "pack" ? getPackerMinimum(moveSize) : getMoverMinimum(moveSize);
  const n =
    typeof selectedCrew === "number" && Number.isFinite(selectedCrew)
      ? Math.round(selectedCrew)
      : 0;
  if (n < minimumRequired) {
    return {
      valid: false,
      minimumRequired,
      message: `${displayLabel(String(moveSize ?? ""))} ${dayType} day requires at least ${minimumRequired} ${dayType === "pack" ? "packers" : "movers"}. ${n} is below this floor and will be overridden to ${minimumRequired} on save.`,
    };
  }
  return { valid: true, minimumRequired };
}
