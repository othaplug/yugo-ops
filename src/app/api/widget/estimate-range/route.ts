import { NextRequest, NextResponse } from "next/server";
import { calculateWidgetPrice, BASE_RATES, OFFICE_BASE_RATES, type WidgetEstimateInput } from "../estimate/route";

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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORTS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORTS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      moveType, moveSize, officeSize,
      fromPostal, toPostal,
      buildingTypeFrom, buildingTypeTo,
      accessFrom, accessTo,
      itemCount, startDate,
      days = 7,
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

      const baseInput: WidgetEstimateInput = {
        moveType: moveType || "residential",
        moveSize: moveSize || "2br",
        officeSize,
        fromPostal,
        toPostal,
        buildingTypeFrom,
        buildingTypeTo,
        accessFrom,
        accessTo,
        itemCount: itemCount || 0,
        moveDate: dateStr,
        preferredTime: "am",
      };

      const amResult = calculateWidgetPrice(baseInput);
      const pmResult = calculateWidgetPrice({ ...baseInput, preferredTime: "pm" });

      estimates.push({
        date: dateStr,
        dayOfWeek: dow,
        dayName: DAY_NAMES[dow]!,
        dayShort: DAY_SHORTS[dow]!,
        monthDay: `${MONTH_SHORTS[d.getMonth()]!} ${d.getDate()}`,
        am: amResult.price,
        pm: pmResult.price,
        available: true,
      });
    }

    return NextResponse.json({ estimates });
  } catch {
    return NextResponse.json({ error: "Failed to calculate estimates" }, { status: 500 });
  }
}
