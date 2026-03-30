/**
 * Estate tier: multi-day pack vs move labour plan (local residential).
 * Used for admin cost estimate, factors_applied (client confirm + emails), and quote copy.
 */

export type EstatePackMoveDay = { crew: number; hours: number };

export type EstateDayPlan = {
  days: number;
  packDay: EstatePackMoveDay | null;
  moveDay: EstatePackMoveDay;
  unpackIncluded: boolean;
};

export function calculateEstateDays(moveSize: string | undefined | null, inventoryScore: number): EstateDayPlan {
  const ms = (moveSize || "2br").toLowerCase().trim();
  const score = Number.isFinite(inventoryScore) ? inventoryScore : 0;

  switch (ms) {
    case "studio":
    case "1br":
      return {
        days: 1,
        packDay: null,
        moveDay: { crew: 2, hours: 5 },
        unpackIncluded: true,
      };
    case "2br":
      if (score > 50) {
        return {
          days: 2,
          packDay: { crew: 2, hours: 5 },
          moveDay: { crew: 3, hours: 6 },
          unpackIncluded: true,
        };
      }
      return {
        days: 1,
        packDay: null,
        moveDay: { crew: 2, hours: 6 },
        unpackIncluded: true,
      };
    case "3br":
      return {
        days: 2,
        packDay: { crew: 2, hours: 6 },
        moveDay: { crew: 3, hours: 7 },
        unpackIncluded: true,
      };
    case "4br":
      return {
        days: 2,
        packDay: { crew: 3, hours: 7 },
        moveDay: { crew: 4, hours: 8 },
        unpackIncluded: true,
      };
    case "5br_plus":
      return {
        days: 3,
        packDay: { crew: 3, hours: 8 },
        moveDay: { crew: 4, hours: 9 },
        unpackIncluded: true,
      };
    default:
      return {
        days: 1,
        packDay: null,
        moveDay: { crew: 2, hours: 5 },
        unpackIncluded: true,
      };
  }
}

export function estateLoadedLabourCost(plan: EstateDayPlan, loadedHourlyRate: number): number {
  const rate = Math.max(0, loadedHourlyRate);
  let total = 0;
  if (plan.packDay) {
    total += plan.packDay.crew * plan.packDay.hours * rate;
  }
  total += plan.moveDay.crew * plan.moveDay.hours * rate;
  return Math.round(total);
}

function addCalendarDaysIso(dateIso: string, deltaDays: number): string {
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

function fmtMoveDayLabel(iso: string): string {
  if (!iso) return "TBD";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
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
