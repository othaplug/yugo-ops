/**
 * Office inventory → labour model. The commercial parallel to
 * estimateLabourFromScore() (residential). Turns an inventory list into the
 * operational numbers the office quoting engine prices from:
 *
 *   - volumeScore   → crew size + truck count
 *   - man-hours, split into the buckets the tiers differ on:
 *       handling   (wrap / disassembly / reassembly)  — billed on ALL tiers
 *       transport  (load / carry / unload)            — billed on ALL tiers
 *       itPack     (pack IT & hardware)               — Signature + Priority
 *       fullPack   (pack everything)                  — Priority only
 *       fullUnpack (unpack everything)                — Priority only
 *   - per-tier wall-clock hours and day count
 *
 * The TIER SCOPE is what makes the prices diverge: Essential is move-only,
 * Signature adds IT packing, Priority adds full pack + unpack + on-site PM.
 * Because every bucket is derived from the actual inventory, each tier is
 * priced from real scope — not a flat multiplier.
 *
 * CALIBRATION v1: constants below are a first cut tuned so the Ataccama job
 * lands at ~6 crew / ~2 trucks / ~2 days. Phase 2 calibrates the dollar layer
 * (rate, trucks, supplies, PM, margin) so a real inventory hits the price
 * anchors ($5,500 / $6,500 / $8,000). Bump the version when constants change.
 */

import {
  officeCatalogItem,
  type OfficeCatalogItem,
} from "@/lib/quotes/office-inventory-catalog";
import {
  OFFICE_TIER_DEFINITIONS,
  OFFICE_TIER_ORDER,
  type OfficeTierKey,
} from "@/lib/tiers/office-tier-definitions";

export const OFFICE_LABOUR_CALIBRATION_VERSION = 1;

// ── Calibration constants (v1) ──
/** Man-hours of load+carry+unload per unit of volumeScore (both legs combined). */
const TRANSPORT_FACTOR = 0.12;
/** Crew efficiency — share of a crew-hour that is productive work. */
const CREW_EFFICIENCY = 0.8;
/** Unpacking effort relative to packing (unpack is a bit faster). */
const UNPACK_RATIO = 0.8;
/** Fixed wall-clock overhead per job (site check-in, COI handoff, equipment, walkthroughs). */
const OVERHEAD_HOURS = 1.5;
/** Max productive hours per crew per day (commercial after-hours / weekend window). */
const MAX_HOURS_PER_DAY = 12;

/** Crew size from total volumeScore. Commercial crews start larger than residential. */
function crewFromVolume(volumeScore: number): number {
  if (volumeScore < 120) return 4;
  if (volumeScore < 210) return 5;
  if (volumeScore < 330) return 6;
  if (volumeScore < 460) return 7;
  return 8;
}

/** Truck fleet (simultaneous trucks) — driven by crew, not single-load cube,
 *  because a commercial move shuttles multiple loads over the day(s). */
function trucksFromCrew(crew: number): number {
  return Math.min(5, Math.max(1, Math.round(crew / 2.5)));
}

/**
 * Truck SIZE from total volumeScore. Small offices ship on 16ft; medium
 * and large offices get 20ft (Yugo's biggest commercial box). Bigger
 * volumes still cap the vehicle size at 20ft — the model adds MORE 20ft
 * trucks via trucksFromCrew() rather than a single monster truck.
 *
 * MV-30348 (volume 306) landed as "large" → 2 × 20ft under this model.
 */
function truckSizeFromVolume(volumeScore: number): "16ft" | "20ft" {
  return volumeScore >= 150 ? "20ft" : "16ft";
}

export interface OfficeInventoryLine {
  slug: string;
  quantity: number;
}

export interface OfficeTierLabour {
  manHours: number;
  wallClockHours: number;
  days: number;
}

export interface OfficeLabourEstimate {
  volumeScore: number;
  crew: number;
  trucks: number;
  /** Truck SIZE per unit ("16ft" small offices, "20ft" medium/large). */
  truckSize: "16ft" | "20ft";
  /** Man-hour buckets (totals across the job). */
  handlingManHours: number;
  transportManHours: number;
  itPackManHours: number;
  fullPackManHours: number;
  fullUnpackManHours: number;
  /** Per-tier rolled-up labour. */
  perTier: Record<OfficeTierKey, OfficeTierLabour>;
  /** Count of recognized line items (catalog hits) and total units. */
  lineCount: number;
  unitCount: number;
  /** Total units flagged IT/electronic (drives Signature IT-supplies). */
  itItemCount: number;
  calibrationVersion: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Estimate office move labour from an inventory list.
 * Unknown slugs are skipped (and not counted) so a typo never inflates a quote.
 */
export function estimateOfficeLabour(
  inventory: OfficeInventoryLine[],
): OfficeLabourEstimate {
  let volumeScore = 0;
  let handlingMin = 0;
  let itPackMin = 0;
  let fullPackMin = 0;
  let lineCount = 0;
  let unitCount = 0;
  let itItemCount = 0;
  let twoPersonPresent = false;

  for (const line of inventory) {
    const qty = Math.max(0, Math.floor(line.quantity || 0));
    if (qty === 0) continue;
    const item: OfficeCatalogItem | null = officeCatalogItem(line.slug);
    if (!item) continue;
    lineCount += 1;
    unitCount += qty;

    volumeScore += qty * item.volumeScore;
    handlingMin += qty * item.handlingMinutes;
    const packMin = qty * item.packMinutes;
    fullPackMin += packMin;
    if (item.flags?.itElectronic) {
      itPackMin += packMin;
      itItemCount += qty;
    }
    if (item.flags?.twoPerson) twoPersonPresent = true;
  }

  const handlingManHours = handlingMin / 60;
  const transportManHours = volumeScore * TRANSPORT_FACTOR;
  const itPackManHours = itPackMin / 60;
  const fullPackManHours = fullPackMin / 60;
  const fullUnpackManHours = fullPackManHours * UNPACK_RATIO;

  let crew = crewFromVolume(volumeScore);
  // Heavy two-person items present → never run a thin crew.
  if (twoPersonPresent) crew = Math.max(crew, 4);
  const trucks = trucksFromCrew(crew);
  const truckSize = truckSizeFromVolume(volumeScore);

  const moveBase = handlingManHours + transportManHours; // billed on every tier
  const perTierManHours: Record<OfficeTierKey, number> = {
    essential: moveBase,
    signature: moveBase + itPackManHours,
    priority: moveBase + fullPackManHours + fullUnpackManHours,
  };

  const perTier = {} as Record<OfficeTierKey, OfficeTierLabour>;
  for (const tier of OFFICE_TIER_ORDER) {
    // Tier may raise the crew floor (Priority runs a bigger team).
    const tierCrew = Math.max(crew, OFFICE_TIER_DEFINITIONS[tier].ops.crewMinimum);
    const manHours = perTierManHours[tier];
    // Productive wall-clock = crew-hours of real work spread across the crew.
    // Day count is driven by productive hours against the daily window; the
    // fixed per-job overhead is absorbed within those days, not added to the
    // day math (otherwise a job a hair over a day boundary tips to an extra day).
    const productiveWallClock = manHours / (tierCrew * CREW_EFFICIENCY);
    const wallClockHours = OVERHEAD_HOURS + productiveWallClock;
    // Essential and Signature are single-day flows by default (client-owned
    // packing + unpacking, so the Yugo-side work is just the move itself
    // and can typically fit in one commercial after-hours window). Admin
    // bumps to multi-day are handled downstream via
    // factors.office_per_tier_days_override. Priority continues to derive
    // day count from labour man-hours because Yugo owns the whole scope.
    const days =
      tier === "priority"
        ? Math.max(1, Math.ceil(productiveWallClock / MAX_HOURS_PER_DAY))
        : 1;
    perTier[tier] = {
      manHours: round1(manHours),
      wallClockHours: round1(wallClockHours),
      days,
    };
  }

  return {
    volumeScore: round1(volumeScore),
    crew,
    trucks,
    truckSize,
    handlingManHours: round1(handlingManHours),
    transportManHours: round1(transportManHours),
    itPackManHours: round1(itPackManHours),
    fullPackManHours: round1(fullPackManHours),
    fullUnpackManHours: round1(fullUnpackManHours),
    perTier,
    lineCount,
    unitCount,
    itItemCount,
    calibrationVersion: OFFICE_LABOUR_CALIBRATION_VERSION,
  };
}
