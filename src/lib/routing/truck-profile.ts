import { DEFAULT_FUEL_PRICE_GAS } from "./fuel-config";

/** Normalized vehicle keys used for exclusions, fuel estimates, and scoring. */
export type CrewRoutingTruckType = "sprinter" | "16ft" | "20ft" | "24ft" | "26ft";

/** L/100km — city-style blend for margin estimates (not exact telematics). */
export const FUEL_L_PER_100KM: Record<CrewRoutingTruckType, number> = {
  sprinter: 12,
  "16ft": 18,
  "20ft": 22,
  "24ft": 20,
  "26ft": 28,
};

export function normalizeCrewTruckType(raw: string | null | undefined): CrewRoutingTruckType {
  const s = (raw || "sprinter").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.includes("sprinter")) return "sprinter";
  if (s.includes("26")) return "26ft";
  if (s.includes("24")) return "24ft";
  if (s.includes("20")) return "20ft";
  if (s.includes("16")) return "16ft";
  return "sprinter";
}

/**
 * Mapbox Directions has no separate truck profile in the public v5 API.
 * We use `driving-traffic` for everyone and layer exclusions + scoring for larger rigs.
 */
export function getRoutingProfile(_truckType: CrewRoutingTruckType): "mapbox/driving-traffic" {
  return "mapbox/driving-traffic";
}

/** Comma-separated `exclude` values for Directions API. */
export function getRouteExclusions(truckType: CrewRoutingTruckType): string {
  const exclusions: string[] = ["ferry"];
  if (truckType !== "sprinter") {
    exclusions.push("toll", "unpaved");
  }
  return exclusions.join(",");
}

export function fuelLitresForDistanceKm(truckType: CrewRoutingTruckType, distanceKm: number): number {
  const rate = FUEL_L_PER_100KM[truckType] ?? FUEL_L_PER_100KM["16ft"];
  return (distanceKm * rate) / 100;
}

export function fuelCostCadForDistanceKm(
  truckType: CrewRoutingTruckType,
  distanceKm: number,
  pricePerLitre: number = DEFAULT_FUEL_PRICE_GAS
): number {
  return fuelLitresForDistanceKm(truckType, distanceKm) * pricePerLitre;
}
