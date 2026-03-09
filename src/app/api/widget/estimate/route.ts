import { NextRequest, NextResponse } from "next/server";

export const BASE_RATES: Record<string, { low: number; high: number }> = {
  studio: { low: 499, high: 699 },
  "1br": { low: 699, high: 999 },
  "2br": { low: 999, high: 1399 },
  "3br": { low: 1399, high: 1999 },
  "4br": { low: 1999, high: 2799 },
  "5br_plus": { low: 2799, high: 3999 },
};

export const OFFICE_BASE_RATES: Record<string, { low: number; high: number }> = {
  small: { low: 999, high: 1499 },
  medium: { low: 1499, high: 2499 },
  large: { low: 2499, high: 3999 },
};

export const TIER_MAP: Record<string, number> = {
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

export function getNeighbourhoodTier(postal: string): number {
  const prefix = postal.substring(0, 3).toUpperCase();
  return TIER_MAP[prefix] || 3;
}

const BUILDING_MULTIPLIERS: Record<string, number> = {
  apartment: 1.0,
  condo: 1.0,
  house: 1.05,
  townhouse: 1.03,
};

const ACCESS_MULTIPLIERS: Record<string, number> = {
  ground: 1.0,
  elevator: 1.02,
  stairs_2: 1.06,
  stairs_3: 1.12,
  stairs_4: 1.18,
  loading_dock: 0.98,
};

const TIME_MULTIPLIERS = { am: 1.05, pm: 1.0, flexible: 1.0 };

export interface WidgetEstimateInput {
  moveType: string;
  moveSize?: string;
  officeSize?: string;
  fromPostal: string;
  toPostal: string;
  buildingTypeFrom?: string;
  buildingTypeTo?: string;
  accessFrom?: string;
  accessTo?: string;
  itemCount?: number;
  moveDate: string | null;
  preferredTime?: string;
}

export interface SingleEstimate {
  price: number;
  factors: string[];
}

export function calculateWidgetPrice(input: WidgetEstimateInput): SingleEstimate {
  const isResidential = input.moveType === "residential";
  const base = isResidential
    ? BASE_RATES[input.moveSize || "2br"]
    : OFFICE_BASE_RATES[input.officeSize || "medium"];

  if (!base) return { price: 0, factors: ["Unknown size"] };

  const midpoint = (base.low + base.high) / 2;
  const factors: string[] = [];

  const fromTier = getNeighbourhoodTier(input.fromPostal);
  const toTier = getNeighbourhoodTier(input.toPostal);
  const avgTier = (fromTier + toTier) / 2;
  const tierMult = 0.9 + avgTier * 0.05;
  if (avgTier >= 4) factors.push("Premium neighbourhood");

  const bldgFrom = BUILDING_MULTIPLIERS[input.buildingTypeFrom || "apartment"] ?? 1.0;
  const bldgTo = BUILDING_MULTIPLIERS[input.buildingTypeTo || "apartment"] ?? 1.0;
  const bldgMult = (bldgFrom + bldgTo) / 2;

  const accFrom = ACCESS_MULTIPLIERS[input.accessFrom || "ground"] ?? 1.0;
  const accTo = ACCESS_MULTIPLIERS[input.accessTo || "ground"] ?? 1.0;
  const accMult = (accFrom + accTo) / 2;
  if (accMult > 1.05) factors.push("Stair carry");

  let seasonMult = 1.0;
  let weekendMult = 1.0;
  let timeMult = TIME_MULTIPLIERS[(input.preferredTime || "flexible") as keyof typeof TIME_MULTIPLIERS] ?? 1.0;

  if (input.moveDate) {
    const d = new Date(input.moveDate + "T12:00:00");
    const month = d.getMonth();
    seasonMult = [6, 7, 8].includes(month) ? 1.15
      : [5, 9].includes(month) ? 1.08
      : [11, 0, 1].includes(month) ? 0.92
      : 1.0;
    weekendMult = (d.getDay() === 0 || d.getDay() === 6) ? 1.1 : 1.0;
    if (seasonMult > 1.05) factors.push("Peak season");
    if (weekendMult > 1) factors.push("Weekend");
  }

  if (timeMult > 1) factors.push("Morning slot");

  let inventoryMult = 1.0;
  if (input.itemCount && input.itemCount > 0) {
    const benchmarks: Record<string, number> = {
      studio: 8, "1br": 14, "2br": 22, "3br": 32, "4br": 42, "5br_plus": 55,
      small: 15, medium: 30, large: 50,
    };
    const sizeKey = isResidential ? (input.moveSize || "2br") : (input.officeSize || "medium");
    const benchmark = benchmarks[sizeKey] ?? 22;
    inventoryMult = Math.max(0.85, Math.min(1.35, input.itemCount / benchmark));
    if (inventoryMult > 1.1) factors.push("Extra items");
  }

  const total = midpoint * tierMult * bldgMult * accMult * seasonMult * weekendMult * timeMult * inventoryMult;
  const price = Math.round(total / 10) * 10;

  return { price: Math.max(399, price), factors };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { moveSize, fromPostalCode, toPostalCode, moveDate } = body;

    if (!moveSize || !fromPostalCode || !toPostalCode) {
      return NextResponse.json({ error: "moveSize, fromPostalCode, and toPostalCode are required" }, { status: 400 });
    }

    const postalRegex = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/;
    if (!postalRegex.test(String(fromPostalCode).trim())) {
      return NextResponse.json({ error: "Invalid Canadian postal code for fromPostalCode" }, { status: 400 });
    }
    if (!postalRegex.test(String(toPostalCode).trim())) {
      return NextResponse.json({ error: "Invalid Canadian postal code for toPostalCode" }, { status: 400 });
    }

    if (!BASE_RATES[moveSize]) {
      return NextResponse.json({ error: "Invalid moveSize" }, { status: 400 });
    }

    const result = calculateWidgetPrice({
      moveType: "residential",
      moveSize,
      fromPostal: fromPostalCode,
      toPostal: toPostalCode,
      moveDate: moveDate || null,
    });

    const spread = 0.15;
    const low = Math.round((result.price * (1 - spread)) / 50) * 50;
    const high = Math.round((result.price * (1 + spread)) / 50) * 50;

    return NextResponse.json({
      low, high,
      factors: result.factors,
      moveSize,
      fromPostal: fromPostalCode,
      toPostal: toPostalCode,
      moveDate: moveDate || null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to calculate estimate" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
