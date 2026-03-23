import { NextRequest, NextResponse } from "next/server";

export interface DateEstimate {
  date: string;
  dayOfWeek: number;
  dayName: string;
  dayShort: string;
  monthDay: string;
  am: number;
  pm: number;
  available: boolean;
}

const BASE_RATES: Record<string, number> = {
  studio: 480, "1br": 720, "2br": 1080, "3br": 1620, "4br": 2160, "5br_plus": 2700, partial: 540,
};

const OFFICE_BASE_RATES: Record<string, number> = {
  small: 900, medium: 1800, large: 3200,
};

const SEASON_MODS: Record<number, number> = {
  1: 0.88, 2: 0.88, 3: 0.92, 4: 0.95, 5: 1.0, 6: 1.1,
  7: 1.15, 8: 1.15, 9: 1.05, 10: 0.95, 11: 0.9, 12: 0.88,
};

const DAY_MODS: Record<number, number> = {
  0: 1.0, 1: 0.92, 2: 0.92, 3: 0.92, 4: 0.95, 5: 1.05, 6: 1.08,
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORTS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORTS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function calculateRangePrice(
  moveType: string, moveSize: string, officeSize: string | undefined,
  fromPostal: string, toPostal: string, dateStr: string, preferredTime: string,
): number {
  const base = moveType === "office"
    ? (OFFICE_BASE_RATES[officeSize || "medium"] ?? 1800)
    : (BASE_RATES[moveSize || "2br"] ?? 1080);

  const d = new Date(dateStr + "T12:00:00");
  const monthNum = d.getMonth() + 1;
  const dow = d.getDay();
  const seasonMod = SEASON_MODS[monthNum] ?? 1.0;
  const dayMod = DAY_MODS[dow] ?? 1.0;
  const timeMod = preferredTime === "am" ? 1.05 : 1.0;

  return Math.round(base * seasonMod * dayMod * timeMod);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      moveType, moveSize, officeSize,
      fromPostal, toPostal,
      startDate, days = 7,
    } = body;

    if (!fromPostal || !toPostal) {
      return NextResponse.json({ error: "fromPostal and toPostal are required" }, { status: 400 });
    }

    const postalRegex = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
    if (!postalRegex.test(String(fromPostal).trim())) {
      return NextResponse.json({ error: "Invalid Canadian postal code for fromPostal" }, { status: 400 });
    }
    if (!postalRegex.test(String(toPostal).trim())) {
      return NextResponse.json({ error: "Invalid Canadian postal code for toPostal" }, { status: 400 });
    }

    if (days !== undefined && (!Number.isInteger(days) || days < 1)) {
      return NextResponse.json({ error: "days must be a positive integer" }, { status: 400 });
    }

    if (moveType === "residential" && moveSize && !BASE_RATES[moveSize]) {
      return NextResponse.json({ error: "Invalid moveSize" }, { status: 400 });
    }

    if (moveType === "office" && officeSize && !OFFICE_BASE_RATES[officeSize]) {
      return NextResponse.json({ error: "Invalid officeSize" }, { status: 400 });
    }

    const start = startDate ? new Date(startDate + "T12:00:00") : new Date();
    if (start < new Date(new Date().toDateString())) {
      start.setTime(new Date().getTime());
    }

    const numDays = Math.min(Math.max(days, 7), 21);
    const estimates: DateEstimate[] = [];

    for (let i = 0; i < numDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0]!;
      const dow = d.getDay();

      const am = calculateRangePrice(moveType || "residential", moveSize || "2br", officeSize, fromPostal, toPostal, dateStr, "am");
      const pm = calculateRangePrice(moveType || "residential", moveSize || "2br", officeSize, fromPostal, toPostal, dateStr, "pm");

      estimates.push({
        date: dateStr,
        dayOfWeek: dow,
        dayName: DAY_NAMES[dow]!,
        dayShort: DAY_SHORTS[dow]!,
        monthDay: `${MONTH_SHORTS[d.getMonth()]!} ${d.getDate()}`,
        am,
        pm,
        available: true,
      });
    }

    return NextResponse.json({ estimates });
  } catch {
    return NextResponse.json({ error: "Failed to calculate estimates" }, { status: 500 });
  }
}
