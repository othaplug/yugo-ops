/**
 * Public instant-quote widget pricing (Essential tier rough estimate).
 * Kept in sync with residential base bands; inventory scoring mirrors quote tooling.
 */

export const WIDGET_RESIDENTIAL_BASE_RATES: Record<string, number> = {
  studio: 449,
  "1br": 649,
  "2br": 999,
  "3br": 1399,
  "4br": 1999,
  "5br_plus": 2699,
  partial: 449,
};

export const WIDGET_OFFICE_BASE_RATES: Record<string, number> = {
  small: 900,
  medium: 1800,
  large: 3200,
};

const EXPECTED_INVENTORY_SCORES: Record<string, number> = {
  studio: 12,
  "1br": 28,
  "2br": 45,
  "3br": 65,
  "4br": 90,
  "5br_plus": 120,
  partial: 12,
};

/** Office move — rough expected score for inventory ratio (pseudo “move size”). */
const OFFICE_EXPECTED_SCORES: Record<string, number> = {
  small: 28,
  medium: 45,
  large: 90,
};

/** Item scores — aligned with widget catalog labels + main residential inventory weighting. */
const ITEM_SCORES: Record<string, number> = {
  "2-Seater Sofa": 4,
  "3-Seater Sofa": 5,
  "Sectional Sofa": 7,
  Armchair: 2.5,
  "Coffee Table": 2,
  "TV Stand": 2.5,
  'TV (32–50")': 1.5,
  'TV (55"+)': 2.5,
  Bookshelf: 3,
  "Floor Lamp": 1,
  "Area Rug": 1.5,
  "Queen Bed + Mattress": 5,
  "King Bed + Mattress": 6,
  "Single / Twin Bed": 3,
  Dresser: 3.5,
  Nightstand: 1,
  "Wardrobe / Armoire": 5,
  Desk: 2.5,
  "Large Mirror": 2,
  "Dining Table (4-seat)": 3,
  "Dining Table (6-8 seat)": 5,
  "Dining Chairs (set of 4)": 2,
  "Buffet / Sideboard": 4,
  "China Cabinet": 5,
  Refrigerator: 5,
  Washer: 4,
  Dryer: 4,
  Dishwasher: 3,
  "Kitchen Island / Cart": 3,
  "Office Desk": 3,
  "Office Chair": 1.5,
  "Filing Cabinet": 2,
  "Computer Monitor": 1,
  Printer: 1,
  "Piano (Upright)": 8,
  "Piano (Grand)": 15,
  "Pool Table": 10,
  "Exercise Equipment": 4,
  "Outdoor Furniture Set": 5,
  "BBQ / Grill": 3,
  "Large Artwork / Painting": 2,
  "Safe / Heavy Box": 5,
};

const SPECIALTY_SURCHARGES: Record<string, number> = {
  "Piano (Upright)": 350,
  "Piano (Grand)": 750,
  "Pool Table": 400,
  "Safe / Heavy Box": 250,
};

/** Access keys from QuoteWidgetClient — map to dollar surcharges (each leg). */
const ACCESS_SURCHARGES: Record<string, number> = {
  elevator: 0,
  ground: 0,
  stairs_2: 75,
  stairs_3: 125,
  stairs_4: 200,
  loading_dock: 0,
};

export function estimateDistanceKmFromPostals(fromPostal: string, toPostal: string): number {
  const fsaNumbers: Record<string, number> = {
    M1: 1,
    M2: 2,
    M3: 3,
    M4: 4,
    M5: 5,
    M6: 6,
    M7: 7,
    M8: 8,
    M9: 9,
    L4: 10,
    L5: 11,
    L6: 12,
    L7: 13,
  };
  const from = (fromPostal || "").replace(/\s/g, "").toUpperCase();
  const to = (toPostal || "").replace(/\s/g, "").toUpperCase();
  const fromNum = fsaNumbers[from.slice(0, 2)] ?? 5;
  const toNum = fsaNumbers[to.slice(0, 2)] ?? 5;
  const diff = Math.abs(fromNum - toNum);
  return Math.max(5, diff * 6);
}

function distanceMultiplier(distanceKm: number): number {
  if (distanceKm <= 5) return 0.95;
  if (distanceKm <= 20) return 1.0;
  if (distanceKm <= 40) return 1.08;
  if (distanceKm <= 60) return 1.15;
  return 1.25;
}

export function calculateInventoryScoreFromWidget(
  items: Record<string, number>,
  estimatedBoxes: number,
): number {
  let score = 0;
  for (const [name, qty] of Object.entries(items)) {
    if (qty <= 0) continue;
    const per = ITEM_SCORES[name] ?? 2;
    score += per * qty;
  }
  score += estimatedBoxes * 0.3;
  return score;
}

function inventoryModifier(moveSize: string, score: number): number {
  const expected = EXPECTED_INVENTORY_SCORES[moveSize] ?? 45;
  const ratio = expected > 0 ? score / expected : 1.0;
  if (ratio < 0.8) {
    const reduction = (1.0 - ratio) * 0.4;
    return Math.max(0.8, 1.0 - reduction);
  }
  if (ratio > 1.2) {
    const increase = (ratio - 1.0) * 0.4;
    return Math.min(1.25, 1.0 + increase);
  }
  return 1.0;
}

function officeInventoryModifier(officeSize: string, score: number): number {
  const expected = OFFICE_EXPECTED_SCORES[officeSize] ?? 45;
  const ratio = expected > 0 ? score / expected : 1.0;
  if (ratio < 0.8) {
    const reduction = (1.0 - ratio) * 0.4;
    return Math.max(0.8, 1.0 - reduction);
  }
  if (ratio > 1.2) {
    const increase = (ratio - 1.0) * 0.4;
    return Math.min(1.25, 1.0 + increase);
  }
  return 1.0;
}

function specialtyAddon(furnitureItems: Record<string, number>): number {
  let add = 0;
  for (const [name, qty] of Object.entries(furnitureItems)) {
    if (qty <= 0) continue;
    const each = SPECIALTY_SURCHARGES[name];
    if (each) add += each * qty;
  }
  return add;
}

/** Calendar date multiplier (weekend + season + month-end), capped. */
export function widgetDateMultiplier(dateStr: string): number {
  const moveDate = new Date(dateStr + "T12:00:00");
  const dayOfWeek = moveDate.getDay();
  const month = moveDate.getMonth();
  const dayOfMonth = moveDate.getDate();

  let m = 1.0;
  if (dayOfWeek === 0 || dayOfWeek === 6) m *= 1.05;
  if (month >= 5 && month <= 7) m *= 1.1;
  else if (month === 4 || month === 8) m *= 1.05;
  else if (month === 3 || month === 9) m *= 1.03;
  if (dayOfMonth <= 3 || dayOfMonth >= 28) m *= 1.05;
  return Math.min(m, 1.2);
}

/** Embed calculator: month-only season factor (no day-of-week). */
export function widgetEmbedMonthMultiplier(monthNum1Based: number): number {
  const month = Math.max(1, Math.min(12, monthNum1Based)) - 1;
  let m = 1.0;
  if (month >= 5 && month <= 7) m *= 1.12;
  else if (month === 4 || month === 8) m *= 1.06;
  else if (month === 3 || month === 9) m *= 1.03;
  if (month >= 0 && month <= 2) m *= 0.92;
  else if (month === 10 || month === 11) m *= 0.9;
  return Math.min(Math.max(m, 0.82), 1.25);
}

export type WidgetEstimateInput = {
  moveType: "residential" | "office";
  moveSize: string;
  officeSize?: string;
  fromPostal: string;
  toPostal: string;
  accessFrom: string;
  accessTo: string;
  furnitureItems: Record<string, number>;
  estimatedBoxes: number;
  dateStr: string;
  timeSlot: "am" | "pm";
  distanceKm?: number;
};

export function calculateWidgetEstimate(input: WidgetEstimateInput): number {
  const distanceKm =
    input.distanceKm ?? estimateDistanceKmFromPostals(input.fromPostal, input.toPostal);

  if (input.moveType === "office") {
    const size = input.officeSize || "medium";
    let price = WIDGET_OFFICE_BASE_RATES[size] ?? 1800;
    const score = calculateInventoryScoreFromWidget(input.furnitureItems, input.estimatedBoxes);
    price *= officeInventoryModifier(size, score);
    price += specialtyAddon(input.furnitureItems);
    price *= distanceMultiplier(distanceKm);
    price += ACCESS_SURCHARGES[input.accessFrom] ?? 0;
    price += ACCESS_SURCHARGES[input.accessTo] ?? 0;
    price *= widgetDateMultiplier(input.dateStr);
    if (input.timeSlot === "pm") price *= 1.03;
    return Math.round(price / 50) * 50;
  }

  const size = input.moveSize || "2br";
  let price = WIDGET_RESIDENTIAL_BASE_RATES[size] ?? 999;
  const score = calculateInventoryScoreFromWidget(input.furnitureItems, input.estimatedBoxes);
  price *= inventoryModifier(size, score);
  price += specialtyAddon(input.furnitureItems);
  price *= distanceMultiplier(distanceKm);
  price += ACCESS_SURCHARGES[input.accessFrom] ?? 0;
  price += ACCESS_SURCHARGES[input.accessTo] ?? 0;
  price *= widgetDateMultiplier(input.dateStr);
  if (input.timeSlot === "pm") price *= 1.03;
  return Math.round(price / 50) * 50;
}
