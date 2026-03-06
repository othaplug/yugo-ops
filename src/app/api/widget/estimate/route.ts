import { NextRequest, NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/platform-settings";

const BASE_RATES: Record<string, { low: number; high: number }> = {
  studio: { low: 499, high: 699 },
  "1br": { low: 699, high: 999 },
  "2br": { low: 999, high: 1399 },
  "3br": { low: 1399, high: 1999 },
  "4br": { low: 1999, high: 2799 },
  "5br_plus": { low: 2799, high: 3999 },
};

const TIER_MAP: Record<string, number> = {
  M5V: 5, M5J: 5, M5H: 5, M4W: 5, M4Y: 5, M5R: 5, M5S: 4,
  M5T: 4, M5E: 4, M5A: 4, M5B: 4, M5C: 4, M5G: 4, M4T: 4,
  M4N: 4, M4P: 4, M4R: 4, M4V: 4, M6G: 3, M6H: 3, M6J: 3,
  M6K: 3, M6R: 3, M6S: 3, M4E: 3, M4K: 3, M4M: 3, M4L: 3,
  M4J: 3, M2N: 3, M2M: 3, M2J: 3, M2K: 3, M2R: 3, M2P: 3,
  M2H: 3, M3A: 3, M3B: 3, M3C: 3, M3H: 3, M3J: 3, M3K: 3,
  M3L: 3, M3M: 3, M3N: 3, M4A: 3, M4B: 3, M4C: 3, M4G: 3,
  M4H: 3, M4S: 3, M4X: 3, M5K: 4, M5L: 4, M5M: 4, M5N: 4,
  M5P: 4, M6A: 2, M6B: 2, M6C: 2, M6E: 2, M6L: 2, M6M: 2,
  M6N: 2, M6P: 3, M9A: 2, M9B: 2, M9C: 2, M9L: 2, M9M: 2,
  M9N: 2, M9P: 2, M9R: 2, M9V: 2, M9W: 2, M8V: 2, M8W: 2,
  M8X: 2, M8Y: 3, M8Z: 2, M1B: 1, M1C: 1, M1E: 1, M1G: 1,
  M1H: 2, M1J: 2, M1K: 2, M1L: 2, M1M: 2, M1N: 2, M1P: 2,
  M1R: 2, M1S: 2, M1T: 2, M1V: 2, M1W: 2, M1X: 2,
};

function getNeighbourhoodTier(postal: string): number {
  const prefix = postal.substring(0, 3).toUpperCase();
  return TIER_MAP[prefix] || 3;
}

interface EstimateResult {
  low: number;
  high: number;
  factors: string[];
  moveSize: string;
  fromPostal: string;
  toPostal: string;
  moveDate: string | null;
}

function calculateWidgetEstimate(
  moveSize: string,
  fromPostal: string,
  toPostal: string,
  moveDate: string | null
): EstimateResult {
  const base = BASE_RATES[moveSize];
  if (!base) {
    return { low: 0, high: 0, factors: ["Unknown move size"], moveSize, fromPostal, toPostal, moveDate };
  }

  let { low, high } = base;

  const fromTier = getNeighbourhoodTier(fromPostal);
  const toTier = getNeighbourhoodTier(toPostal);
  const avgTier = (fromTier + toTier) / 2;
  const tierMultiplier = 0.9 + avgTier * 0.05;

  let seasonMultiplier = 1.0;
  let weekendMultiplier = 1.0;
  const factors: string[] = [];

  if (moveDate) {
    const d = new Date(moveDate);
    const month = d.getMonth();
    seasonMultiplier = [6, 7, 8].includes(month)
      ? 1.15
      : [5, 9].includes(month)
        ? 1.08
        : [11, 0, 1].includes(month)
          ? 0.92
          : 1.0;

    const dayOfWeek = d.getDay();
    weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.1 : 1.0;

    if (seasonMultiplier > 1.05) factors.push("Peak season");
    if (weekendMultiplier > 1) factors.push("Weekend move");
  }

  if (avgTier >= 4) factors.push("Premium neighbourhood");

  low = Math.round(low * tierMultiplier * seasonMultiplier * weekendMultiplier);
  high = Math.round(high * tierMultiplier * seasonMultiplier * weekendMultiplier);

  low = Math.round(low / 50) * 50;
  high = Math.round(high / 50) * 50;

  return { low, high, factors, moveSize, fromPostal, toPostal, moveDate };
}

export async function POST(req: NextRequest) {
  try {
    const widgetEnabled = await isFeatureEnabled("instant_quote_widget");
    if (!widgetEnabled) {
      return NextResponse.json(
        { disabled: true, message: "Get in touch for a personalized quote. We'll respond within 2 hours." },
        { status: 200 }
      );
    }

    const body = await req.json();
    const { moveSize, fromPostalCode, toPostalCode, moveDate } = body;

    if (!moveSize || !fromPostalCode || !toPostalCode) {
      return NextResponse.json({ error: "moveSize, fromPostalCode, and toPostalCode are required" }, { status: 400 });
    }

    if (!BASE_RATES[moveSize]) {
      return NextResponse.json({ error: "Invalid moveSize" }, { status: 400 });
    }

    const estimate = calculateWidgetEstimate(moveSize, fromPostalCode, toPostalCode, moveDate || null);

    return NextResponse.json(estimate);
  } catch {
    return NextResponse.json({ error: "Failed to calculate estimate" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
