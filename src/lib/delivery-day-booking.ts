/* ─── Delivery Day Booking — shared types, item catalog, recommendation logic ─── */

export type ItemSize = "large" | "medium" | "small" | "oversized";
export type VehicleType = "sprinter" | "16ft" | "20ft" | "26ft";
export type DayType = "full_day" | "half_day";
export type TimeWindow = "morning" | "afternoon" | "full_day";

/* ─── Catalog ─── */

export const ITEM_CATALOG: Record<ItemSize, string[]> = {
  large: [
    "Sofa", "Bed Frame", "Mattress", "Dining Table", "Dresser",
    "Armoire", "Bookshelf", "Desk", "Sectional",
  ],
  medium: [
    "Chair", "Nightstand", "Coffee Table", "Side Table",
    "TV Stand", "Bar Cart", "Ottoman",
  ],
  small: [
    "Lamp", "Mirror", "Stool", "Plant Stand", "Accessories (box)",
  ],
  oversized: [
    "Piano", "Safe", "Marble Table", "Pool Table",
    "Sculpture", "Large Artwork",
  ],
};

export const SIZE_LABELS: Record<ItemSize, string> = {
  large: "Large",
  medium: "Medium",
  small: "Small",
  oversized: "Oversized",
};

export const VEHICLE_OPTIONS: { value: VehicleType; label: string; short: string }[] = [
  { value: "sprinter", label: "Cargo Van (Sprinter)", short: "Sprinter" },
  { value: "16ft", label: "16 ft Box Truck", short: "16 ft" },
  { value: "20ft", label: "20 ft Box Truck", short: "20 ft" },
  { value: "26ft", label: "26 ft Box Truck", short: "26 ft" },
];

export const TIME_WINDOW_CHOICES: { value: TimeWindow; label: string; range: string }[] = [
  { value: "morning", label: "Morning", range: "8 AM – 12 PM" },
  { value: "afternoon", label: "Afternoon", range: "12 PM – 5 PM" },
  { value: "full_day", label: "Full Day", range: "8 AM – 5 PM" },
];

/* ─── Stop types ─── */

export interface StopItem {
  name: string;
  size: ItemSize;
  quantity: number;
}

export interface StopDetail {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  zone: number | null;
  zoneName: string;
  customerName: string;
  customerPhone: string;
  items: StopItem[];
  services: Record<string, { enabled: boolean; quantity: number }>;
  instructions: string;
}

export function createEmptyStop(): StopDetail {
  return {
    id: crypto.randomUUID(),
    address: "",
    lat: null,
    lng: null,
    zone: null,
    zoneName: "",
    customerName: "",
    customerPhone: "",
    items: [],
    services: {},
    instructions: "",
  };
}

/* ─── Truck recommendation ─── */

export function recommendTruck(stops: StopDetail[]): VehicleType {
  let totalLarge = 0;
  let totalMedium = 0;
  let totalSmall = 0;
  let hasOversized = false;

  for (const stop of stops) {
    for (const item of stop.items) {
      if (item.size === "oversized") hasOversized = true;
      else if (item.size === "large") totalLarge += item.quantity;
      else if (item.size === "medium") totalMedium += item.quantity;
      else totalSmall += item.quantity;
    }
  }

  const volumeScore = totalLarge + totalMedium * 0.5 + totalSmall * 0.2;

  if (hasOversized) return "20ft";
  if (volumeScore <= 3) return "sprinter";
  if (volumeScore <= 8) return "16ft";
  if (volumeScore <= 15) return "20ft";
  return "26ft";
}

export function recommendDayType(stopCount: number): DayType {
  return stopCount <= 3 ? "half_day" : "full_day";
}

/* ─── Zone detection (client-side, Haversine) ─── */

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function detectZoneFromCoords(
  pickupLat: number,
  pickupLng: number,
  stopLat: number,
  stopLng: number,
): { zone: number; zoneName: string } {
  const distKm = haversineKm(pickupLat, pickupLng, stopLat, stopLng);
  if (distKm < 40) return { zone: 1, zoneName: "GTA Core" };
  if (distKm < 70) return { zone: 2, zoneName: "Outer GTA" };
  if (distKm < 100) return { zone: 3, zoneName: "Extended" };
  return { zone: 4, zoneName: "Remote" };
}

/* ─── Item summary ─── */

export function getItemSummary(stops: StopDetail[]) {
  let large = 0;
  let medium = 0;
  let small = 0;
  let oversized = 0;
  for (const stop of stops) {
    for (const item of stop.items) {
      if (item.size === "large") large += item.quantity;
      else if (item.size === "medium") medium += item.quantity;
      else if (item.size === "small") small += item.quantity;
      else oversized += item.quantity;
    }
  }
  return { totalItems: large + medium + small + oversized, large, medium, small, oversized };
}
