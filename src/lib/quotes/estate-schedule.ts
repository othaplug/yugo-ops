/**
 * Estate tier: multi-day pack vs move labour plan (local residential).
 * Used for admin cost estimate, factors_applied (client confirm + emails), and quote copy.
 *
 * Crew counts are floored by src/lib/quotes/crew-and-truck-minimums.ts so
 * a 3BR Estate plan can't ship with fewer than 4 movers / 3 packers
 * regardless of the per-size table below. The table below remains as
 * the BASELINE; the floor only kicks in when the baseline is too low
 * for the move size. See the lib for rationale (operator audit
 * 2026-05: 3BR with 3 movers + 2 packers was operationally
 * unworkable).
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
    case "1br":
      return applyMinimums({
        moveSize: ms,
        days: 1,
        packDay: null,
        moveDay: { crew: 2, hours: 5 },
        unpackIncluded: true,
      });
    case "2br":
      if (score > 50) {
        return applyMinimums({
          moveSize: ms,
          days: 2,
          packDay: { crew: 2, hours: 5 },
          moveDay: { crew: 3, hours: 6 },
          unpackIncluded: true,
        });
      }
      return applyMinimums({
        moveSize: ms,
        days: 1,
        packDay: null,
        moveDay: { crew: 2, hours: 6 },
        unpackIncluded: true,
      });
    case "3br":
      return applyMinimums({
        moveSize: ms,
        days: 2,
        packDay: { crew: 2, hours: 6 }, // floored to 3 packers below
        moveDay: { crew: 3, hours: 7 }, // floored to 4 movers below
        unpackIncluded: true,
      });
    case "4br":
      return applyMinimums({
        moveSize: ms,
        days: 2,
        packDay: { crew: 3, hours: 7 }, // floored to 4 packers below
        moveDay: { crew: 4, hours: 8 },
        unpackIncluded: true,
      });
    case "5br_plus":
      return applyMinimums({
        moveSize: ms,
        days: 3,
        packDay: { crew: 3, hours: 8 }, // floored to 4 packers below
        moveDay: { crew: 4, hours: 9 }, // floored to 5 movers below
        unpackIncluded: true,
      });
    default:
      return applyMinimums({
        moveSize: ms,
        days: 1,
        packDay: null,
        moveDay: { crew: 2, hours: 5 },
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

/** Human-readable lines for quote confirm + emails (not raw DB keys). */
export function buildEstateScheduleLines(
  plan: EstateDayPlan,
  moveDateIso: string,
  truckLabel: string,
): string[] {
  const move = moveDateIso?.trim() || "";
  const packIso = plan.packDay ? addCalendarDaysIso(move, -1) : "";

  if (plan.days <= 1 || !plan.packDay) {
    const h = Math.round(plan.moveDay.hours);
    return [
      `Single-day visit: pack, move, and unpack. ${plan.moveDay.crew} crew members, about ${h} hours, ${truckLabel}.`,
    ];
  }

  const packDate = fmtMoveDayLabel(packIso);
  const moveDate = fmtMoveDayLabel(move);
  const ph = Math.round(plan.packDay.hours);
  const mh = Math.round(plan.moveDay.hours);

  if (plan.days >= 3) {
    return [
      `Packing (${packDate}): ${plan.packDay.crew} professional packers, about ${ph} hours. Belongings packed, labeled, and protected.`,
      `Move and unpack (${moveDate} onward): ${plan.moveDay.crew} movers and ${truckLabel}. Placement and unpacking at destination, about ${mh} hours per day. Your coordinator confirms the final schedule.`,
    ];
  }

  return [
    `Packing (${packDate}): ${plan.packDay.crew} professional packers, about ${ph} hours. Belongings packed, labeled, and protected.`,
    `Move and unpack (${moveDate}): ${plan.moveDay.crew} movers and ${truckLabel}. Full move, placement, and unpacking at destination, about ${mh} hours.`,
  ];
}

export function estateScheduleHeadline(plan: EstateDayPlan): string {
  if (plan.days <= 1) return "Estate · single-day plan";
  return `Estate · ${plan.days}-day plan`;
}
