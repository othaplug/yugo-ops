/**
 * Estate tier: multi-day pack vs move labour plan (local residential).
 * Used for admin cost estimate, factors_applied (client confirm + emails), and quote copy.
 *
 * Calibrated 2026-06-11 against:
 *   - AMSA (American Moving & Storage Assoc.) packing productivity standard
 *   - Crown Worldwide "Move Specialist Reference Guide" v.7.2
 *   - NAVL (North American Van Lines) Capacity Planning Tool
 *
 * Key calibration sources for crew × hours per day:
 *   Studio:       1 packer × 3-4h     → 1 × 4h
 *   1BR:          2 packers × 4-6h    → bundled with move day (single long day)
 *   2BR (light):  bundled single day  → 3 × 7h move
 *   2BR (heavy):  2 × 5h pack + 3 × 7h move
 *   3BR:         3 packers × 7h pack + 4 movers × 10h move (NAVL Estate spec)
 *   4BR:         3 packers × 9h pack + 4 movers × 11h move + 3 × 6h SEPARATE unpack
 *   5BR+:        3 packers × 10h pack + 5 movers × 12h move + 4 × 8h SEPARATE unpack
 *
 * The big design change vs the prior version: 4BR and 5BR_plus now have a
 * separate `unpackDay` field (was bundled into moveDay hours). Operator
 * feedback 2026-06-11: trying to do 4BR move + unpack on a single 14h day
 * was operationally unworkable — crews ran past midnight on real jobs.
 * Splitting unpack to a third calendar day matches industry standard for
 * full-service white-glove moves at this size.
 *
 * Crew counts are floored by src/lib/quotes/crew-and-truck-minimums.ts so
 * a 3BR Estate plan can't ship with fewer than 4 movers / 3 packers
 * regardless of the per-size table below.
 */

import {
  floorMoversByMoveSize,
  floorPackersByMoveSize,
} from "@/lib/quotes/crew-and-truck-minimums";

export type EstatePackMoveDay = { crew: number; hours: number };

export type EstateDayPlan = {
  days: number;
  packDay: EstatePackMoveDay | null;
  moveDay: EstatePackMoveDay;
  /**
   * Separate unpack day, set for 4BR+ Estate (and any plan where unpack
   * deserves its own calendar day). When null, unpack labour is bundled
   * INTO moveDay.hours (the legacy behaviour for studio/1BR/2BR/3BR).
   */
  unpackDay: EstatePackMoveDay | null;
  /**
   * Convenience flag: true when unpack labour is included in the plan
   * (whether bundled into moveDay or as its own unpackDay). The opposite
   * (unpackIncluded: false) would mean "client unpacks themselves" — not
   * applicable to Estate tier; always true here.
   */
  unpackIncluded: boolean;
};

export function calculateEstateDays(
  moveSize: string | undefined | null,
  inventoryScore: number,
): EstateDayPlan {
  const ms = (moveSize || "2br").toLowerCase().trim();
  const score = Number.isFinite(inventoryScore) ? inventoryScore : 0;

  switch (ms) {
    case "studio":
      // Studio Estate: one long day. AMSA pack benchmark 3-4h × 1 packer
      // rolled into move-day pace (no separate pack day for studio).
      return applyMinimums({
        moveSize: ms,
        days: 1,
        packDay: null,
        moveDay: { crew: 2, hours: 5 },
        unpackDay: null,
        unpackIncluded: true,
      });
    case "1br":
      // 1BR Estate: single long day pack-move-unpack. Crown manual: 1BR
      // Estate full-service typically 8-10h with 2 packers/movers.
      return applyMinimums({
        moveSize: ms,
        days: 1,
        packDay: null,
        moveDay: { crew: 2, hours: 6 },
        unpackDay: null,
        unpackIncluded: true,
      });
    case "2br":
      // Light 2BR Estate (score ≤ 50): single day, 3 crew × 7h.
      // Heavy 2BR (score > 50): pack day + move day. Crown manual: 2BR
      // pack 5-7h × 2 packers, move 6-7h × 3 movers.
      if (score > 50) {
        return applyMinimums({
          moveSize: ms,
          days: 2,
          packDay: { crew: 2, hours: 6 },
          moveDay: { crew: 3, hours: 7 },
          unpackDay: null,
          unpackIncluded: true,
        });
      }
      return applyMinimums({
        moveSize: ms,
        days: 1,
        packDay: null,
        moveDay: { crew: 3, hours: 7 },
        unpackDay: null,
        unpackIncluded: true,
      });
    case "3br":
      // 3BR Estate: 2 days. NAVL Capacity Tool: 3BR Estate pack 7-8h × 3
      // packers + move 10-12h × 4 movers (incl. unpack). Operator
      // confirmed 2026-06-11: move + unpack is 10-12h for 3BR.
      return applyMinimums({
        moveSize: ms,
        days: 2,
        packDay: { crew: 3, hours: 7 },
        moveDay: { crew: 4, hours: 10 },
        unpackDay: null, // bundled into 10h move day
        unpackIncluded: true,
      });
    case "4br":
      // 4BR Estate: 3 days. NAVL benchmark + operator feedback: pack 9h ×
      // 3 packers, move 11h × 4 movers, SEPARATE unpack 6h × 3 next day.
      // Trying to do move + unpack as single 14h day breaks crew
      // operationally (seen on real jobs running past midnight).
      return applyMinimums({
        moveSize: ms,
        days: 3,
        packDay: { crew: 3, hours: 9 },
        moveDay: { crew: 4, hours: 11 },
        unpackDay: { crew: 3, hours: 6 },
        unpackIncluded: true,
      });
    case "5br_plus":
      // 5BR+ Estate: 3 days minimum (sometimes 4 — see large-volume
      // logic in move-scope.ts which adds a volume_day on top). NAVL:
      // pack 10-12h × 3-4 packers, move 12h × 5 movers, unpack 8h × 4.
      return applyMinimums({
        moveSize: ms,
        days: 3,
        packDay: { crew: 3, hours: 10 },
        moveDay: { crew: 5, hours: 12 },
        unpackDay: { crew: 4, hours: 8 },
        unpackIncluded: true,
      });
    default:
      return applyMinimums({
        moveSize: ms,
        days: 1,
        packDay: null,
        moveDay: { crew: 2, hours: 5 },
        unpackDay: null,
        unpackIncluded: true,
      });
  }
}

/**
 * Apply the hard crew minimums from crew-and-truck-minimums.ts to an
 * EstateDayPlan. Pack crew floored to PACKER_MINIMUMS, move crew to
 * MOVER_MINIMUMS. If the table baseline above is already at or above
 * the floor, the plan is returned unchanged.
 */
function applyMinimums(
  plan: EstateDayPlan & { moveSize: string },
): EstateDayPlan {
  const { moveSize, ...rest } = plan;
  return {
    ...rest,
    packDay: rest.packDay
      ? { ...rest.packDay, crew: floorPackersByMoveSize(rest.packDay.crew, moveSize) }
      : null,
    moveDay: {
      ...rest.moveDay,
      crew: floorMoversByMoveSize(rest.moveDay.crew, moveSize),
    },
    // Unpack uses MOVER floors (not packer floors) — unpacking at the
    // destination is a placement / assembly task closer to moving than
    // to packing. Crown manual aligns with this categorization.
    unpackDay: rest.unpackDay
      ? { ...rest.unpackDay, crew: floorMoversByMoveSize(rest.unpackDay.crew, moveSize) }
      : null,
  };
}

export function estateLoadedLabourCost(
  plan: EstateDayPlan,
  loadedHourlyRate: number,
): number {
  const rate = Math.max(0, loadedHourlyRate);
  let total = 0;
  if (plan.packDay) {
    total += plan.packDay.crew * plan.packDay.hours * rate;
  }
  total += plan.moveDay.crew * plan.moveDay.hours * rate;
  // Separate unpack day (4BR+ Estate). When null, unpack labour is
  // already inside moveDay.hours so we don't add it twice.
  if (plan.unpackDay) {
    total += plan.unpackDay.crew * plan.unpackDay.hours * rate;
  }
  return Math.round(total);
}

export function addCalendarDaysIso(dateIso: string, deltaDays: number): string {
  const base = dateIso?.trim();
  if (!base) return "";
  const d = new Date(`${base}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * First on-site packing calendar day for Estate (same rules as quote schedule copy).
 * Single-day Estate plans pack on move day; multi-day plans pack the day before move.
 */
export function estatePackingDayIso(
  moveDateIso: string,
  moveSize: string | null | undefined,
  inventoryScore: number | null | undefined,
): string {
  const move = moveDateIso?.trim() || "";
  if (!move) return "";
  const plan = calculateEstateDays(moveSize, Number(inventoryScore) || 0);
  if (plan.packDay) {
    return addCalendarDaysIso(move, -1);
  }
  return move;
}

/**
 * Cron "T-2 calendar days" balance window: non-Estate = 2 days before move day;
 * Estate = 2 days before packing day (derived from move_size + inventory_score).
 */
export function moveMatchesBalanceReminder48hWindow(params: {
  scheduledDate: string;
  twoDaysOutIso: string;
  tierSelected: string | null | undefined;
  serviceTier?: string | null | undefined;
  moveSize: string | null | undefined;
  inventoryScore: number | null | undefined;
}): boolean {
  const tier = String(params.tierSelected || params.serviceTier || "")
    .toLowerCase()
    .trim();
  if (tier !== "estate") {
    return params.scheduledDate === params.twoDaysOutIso;
  }
  const packing = estatePackingDayIso(
    params.scheduledDate,
    params.moveSize,
    params.inventoryScore,
  );
  return packing === params.twoDaysOutIso;
}

function fmtMoveDayLabel(iso: string): string {
  if (!iso) return "TBD";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Human-readable lines for quote confirm + emails (not raw DB keys).
 *
 * Move day intentionally does NOT carry an hours estimate. Stating
 * "about 7 hours" creates a contract expectation that doesn't survive
 * real-world friction (long carries, elevator delays, traffic, client
 * pace) — and a client whose move ran 9 hours after being told 7 reads
 * the variance as a service failure rather than normal scope. Move day
 * is a full-day commitment; the coordinator confirms timing the day-of.
 * Pack day still shows hours because pack day is more bounded (the box
 * count is the rate-limit, not the route) and the variance is smaller.
 */
export function buildEstateScheduleLines(
  plan: EstateDayPlan,
  moveDateIso: string,
  truckLabel: string,
): string[] {
  const move = moveDateIso?.trim() || "";
  // packIso = day before move; unpackIso = day after move (when plan
  // splits unpack into its own calendar day for 4BR+ Estate).
  const packIso = plan.packDay ? addCalendarDaysIso(move, -1) : "";
  const unpackIso = plan.unpackDay ? addCalendarDaysIso(move, 1) : "";

  if (plan.days <= 1 || !plan.packDay) {
    return [
      `Single-day visit: pack, move, and unpack. ${plan.moveDay.crew} crew members, ${truckLabel}. Full day.`,
    ];
  }

  const packDate = fmtMoveDayLabel(packIso);
  const moveDate = fmtMoveDayLabel(move);
  const ph = Math.round(plan.packDay.hours);

  // 4BR+ Estate (or any plan with a separate unpack day): three distinct
  // calendar days. Move day no longer "moves and unpacks" — unpack gets
  // its own line. This was the operator's ask 2026-06-11 ("sometimes day
  // 3 for 4 bedroom plus").
  if (plan.unpackDay) {
    const unpackDate = fmtMoveDayLabel(unpackIso);
    const uh = Math.round(plan.unpackDay.hours);
    return [
      `Packing (${packDate}): ${plan.packDay.crew} professional packers, about ${ph} hours. Belongings packed, labeled, and protected.`,
      `Move (${moveDate}): ${plan.moveDay.crew} movers and ${truckLabel}. Full transport and initial placement at destination.`,
      `Unpacking (${unpackDate}): ${plan.unpackDay.crew} crew members, about ${uh} hours. Final placement, kitchen/wardrobe setup, debris removal.`,
    ];
  }

  if (plan.days >= 3) {
    return [
      `Packing (${packDate}): ${plan.packDay.crew} professional packers, about ${ph} hours. Belongings packed, labeled, and protected.`,
      `Move and unpack (${moveDate} onward): ${plan.moveDay.crew} movers and ${truckLabel}. Placement and unpacking at destination across the full schedule. Your coordinator confirms the final timing.`,
    ];
  }

  return [
    `Packing (${packDate}): ${plan.packDay.crew} professional packers, about ${ph} hours. Belongings packed, labeled, and protected.`,
    `Move and unpack (${moveDate}): ${plan.moveDay.crew} movers and ${truckLabel}. Full move, placement, and unpacking at destination. Full day.`,
  ];
}

export function estateScheduleHeadline(plan: EstateDayPlan): string {
  if (plan.days <= 1) return "Estate · single-day plan";
  return `Estate · ${plan.days}-day plan`;
}
