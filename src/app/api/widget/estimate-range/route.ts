import { NextRequest, NextResponse } from "next/server";
import {
  calculateWidgetEstimate,
  WIDGET_OFFICE_BASE_RATES,
  WIDGET_RESIDENTIAL_BASE_RATES,
} from "@/lib/pricing/widget-estimate";

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
      moveType,
      moveSize,
      officeSize,
      fromPostal,
      toPostal,
      accessFrom,
      accessTo,
      startDate,
      days = 7,
      furnitureItems,
      estimatedBoxes,
    } = body as {
      moveType?: string;
      moveSize?: string;
      officeSize?: string;
      fromPostal?: string;
      toPostal?: string;
      accessFrom?: string;
      accessTo?: string;
      startDate?: string;
      days?: number;
      furnitureItems?: Record<string, number>;
      estimatedBoxes?: number;
    };

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

    const mt = moveType === "office" ? "office" : "residential";

    if (mt === "residential" && moveSize && !WIDGET_RESIDENTIAL_BASE_RATES[moveSize]) {
      return NextResponse.json({ error: "Invalid moveSize" }, { status: 400 });
    }
    if (mt === "office" && officeSize && !WIDGET_OFFICE_BASE_RATES[officeSize]) {
      return NextResponse.json({ error: "Invalid officeSize" }, { status: 400 });
    }
    const fRaw = furnitureItems && typeof furnitureItems === "object" && !Array.isArray(furnitureItems) ? furnitureItems : {};
    const furniture: Record<string, number> = {};
    for (const [k, v] of Object.entries(fRaw)) {
      const q = typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
      if (q > 0) furniture[k] = q;
    }
    const boxes =
      typeof estimatedBoxes === "number" && Number.isFinite(estimatedBoxes)
        ? Math.max(0, estimatedBoxes)
        : 30;

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

      const baseInput = {
        moveType: mt as "residential" | "office",
        moveSize: mt === "residential" ? moveSize || "2br" : "2br",
        officeSize: mt === "office" ? officeSize || "medium" : undefined,
        fromPostal: String(fromPostal),
        toPostal: String(toPostal),
        accessFrom: accessFrom || "ground",
        accessTo: accessTo || "ground",
        furnitureItems: furniture,
        estimatedBoxes: boxes,
        dateStr,
      };

      const am = calculateWidgetEstimate({ ...baseInput, timeSlot: "am" });
      const pm = calculateWidgetEstimate({ ...baseInput, timeSlot: "pm" });

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
