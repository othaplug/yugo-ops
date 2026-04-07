import { applyTorontoIntelligence } from "./torontoIntelligence";
import type { MapboxDirectionRoute, MapboxDirectionsResponse } from "./route-types";
import { DEFAULT_FUEL_PRICE_GAS } from "./fuel-config";
import {
  type CrewRoutingTruckType,
  fuelCostCadForDistanceKm,
  getRouteExclusions,
  getRoutingProfile,
  normalizeCrewTruckType,
} from "./truck-profile";

export type { MapboxDirectionRoute } from "./route-types";

export type ScoredRouteSummary = {
  index: number;
  durationSec: number;
  distanceM: number;
  score: number;
  etaLabel: string;
  distanceLabel: string;
  fuelCostLabel: string;
  congestionNote: string | null;
};

/** Normalized keys for Mapbox `annotation.congestion` → map line styling. */
export type RouteCongestionKey = "unknown" | "low" | "moderate" | "heavy" | "severe";

export type TrafficRouteFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { congestion: RouteCongestionKey };
    geometry: { type: "LineString"; coordinates: [number, number][] };
  }>;
};

/** One Mapbox alternative (same `index` as Directions API `routes[i]`). */
export type CrewRouteAlternative = {
  index: number;
  route: MapboxDirectionRoute;
  coordinates: [number, number][];
  trafficRouteGeoJson: TrafficRouteFeatureCollection;
};

export type IntelligentRouteResult = {
  route: MapboxDirectionRoute;
  coordinates: [number, number][];
  /** One feature per contiguous traffic level; properties.congestion for data-driven line color. */
  trafficRouteGeoJson: TrafficRouteFeatureCollection;
  truckType: CrewRoutingTruckType;
  summaries: ScoredRouteSummary[];
  selectedIndex: number;
  torontoWarnings: string[];
  /** All alternatives with geometry — crew can switch without refetching. */
  alternatives: CrewRouteAlternative[];
};

export type FetchIntelligentRouteOptions = {
  /** From platform_config (gas or diesel); defaults to gasoline default if omitted. */
  fuelPriceCadPerLitre?: number;
};

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const m = Math.max(1, Math.round(seconds / 60));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

function formatDistanceM(m: number): string {
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatMoneyCad(n: number): string {
  return `~$${n.toFixed(2)}`;
}

/**
 * Score alternatives: balances time, distance/fuel, congestion, and turn complexity.
 * Higher score is better.
 */
export function scoreRoute(route: MapboxDirectionRoute, truckType: CrewRoutingTruckType): number {
  let score = 100;
  const durationMinutes = route.duration / 60;
  const distanceKm = route.distance / 1000;

  score -= durationMinutes * 0.5;
  score += distanceKm * -0.3;

  const congestion = route.legs?.[0]?.annotation?.congestion;
  if (congestion?.length) {
    const severeSegments = congestion.filter((c) => c === "severe" || c === "heavy").length;
    const congestionRate = severeSegments / congestion.length;
    score -= congestionRate * 30;
  }

  const steps = route.legs?.[0]?.steps || [];
  if (steps.length) {
    const turns = steps.filter((s) => {
      const t = (s.maneuver?.type || "").toLowerCase();
      return t === "turn" || t === "end of road";
    }).length;
    if (truckType !== "sprinter") {
      score -= turns * 0.5;
    }
  }

  if (distanceKm > 10 && steps.length) {
    const highwaySteps = steps.filter((s) => {
      const n = `${s.name || ""}`.toLowerCase();
      return (
        n.includes("hwy") ||
        n.includes("highway") ||
        n.includes("expressway") ||
        n.includes("qew") ||
        n.includes("dvp") ||
        n.includes("gardiner") ||
        /\b401\b/.test(n) ||
        /\b427\b/.test(n) ||
        /\b404\b/.test(n) ||
        /\b400\b/.test(n)
      );
    }).length;
    if (highwaySteps > 0) score += 10;
  }

  return score;
}

export function normalizeRouteCongestion(raw: string | undefined | null): RouteCongestionKey {
  const c = `${raw || "unknown"}`.toLowerCase();
  if (c === "severe") return "severe";
  if (c === "heavy") return "heavy";
  if (c === "moderate") return "moderate";
  if (c === "low") return "low";
  return "unknown";
}

/**
 * Split full-route coordinates into LineString features using per-segment congestion from Directions API.
 * `congestion[i]` applies to the segment from coordinates[i] → coordinates[i+1].
 */
export function buildTrafficColoredRouteGeoJson(
  coordinates: [number, number][],
  congestion: string[] | undefined | null
): TrafficRouteFeatureCollection {
  if (!coordinates || coordinates.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }
  const n = coordinates.length - 1;
  if (!congestion?.length || congestion.length !== n) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { congestion: "unknown" },
          geometry: { type: "LineString", coordinates },
        },
      ],
    };
  }

  const features: TrafficRouteFeatureCollection["features"] = [];
  let segStart = 0;
  for (let i = 0; i < congestion.length; i++) {
    const level = normalizeRouteCongestion(congestion[i]);
    const isLast = i === congestion.length - 1;
    const nextLevel = isLast ? null : normalizeRouteCongestion(congestion[i + 1]);
    if (isLast || nextLevel !== level) {
      const slice = coordinates.slice(segStart, i + 2);
      if (slice.length >= 2) {
        features.push({
          type: "Feature",
          properties: { congestion: level },
          geometry: { type: "LineString", coordinates: slice },
        });
      }
      segStart = i + 1;
    }
  }
  if (features.length === 0) {
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { congestion: "unknown" }, geometry: { type: "LineString", coordinates } }],
    };
  }
  return { type: "FeatureCollection", features };
}

function congestionNoteForRoute(route: MapboxDirectionRoute): string | null {
  const congestion = route.legs?.[0]?.annotation?.congestion;
  if (!congestion?.length) return null;
  const severeSegments = congestion.filter((c) => c === "severe" || c === "heavy").length;
  const rate = severeSegments / congestion.length;
  if (rate > 0.35) return "Heavy congestion on much of this path";
  if (rate > 0.15) return "Some heavy traffic segments";
  return null;
}

function buildDirectionsUrl(
  accessToken: string,
  profile: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  exclude: string
): string {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const params = new URLSearchParams({
    steps: "true",
    geometries: "geojson",
    overview: "full",
    alternatives: "true",
    annotations: "duration,distance,speed,congestion",
    access_token: accessToken,
  });
  if (exclude) params.set("exclude", exclude);
  return `https://api.mapbox.com/directions/v5/${profile}/${coords}?${params.toString()}`;
}

/**
 * Fetch traffic-aware directions, pick the best alternative via `scoreRoute`, attach Toronto heuristics.
 */
export async function fetchIntelligentRoute(
  accessToken: string,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  truckTypeRaw: string | null | undefined,
  options?: FetchIntelligentRouteOptions
): Promise<IntelligentRouteResult | null> {
  const fuelPL =
    typeof options?.fuelPriceCadPerLitre === "number" &&
    Number.isFinite(options.fuelPriceCadPerLitre) &&
    options.fuelPriceCadPerLitre > 0
      ? options.fuelPriceCadPerLitre
      : DEFAULT_FUEL_PRICE_GAS;
  const truckType = normalizeCrewTruckType(truckTypeRaw);
  const profile = getRoutingProfile(truckType);
  const exclude = getRouteExclusions(truckType);
  const url = buildDirectionsUrl(accessToken, profile, origin, destination, exclude);

  let data: MapboxDirectionsResponse;
  try {
    const res = await fetch(url);
    data = (await res.json()) as MapboxDirectionsResponse;
  } catch {
    return null;
  }

  const routes = data?.routes;
  if (!routes?.length) return null;

  const alternatives: CrewRouteAlternative[] = [];
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    const coords = route.geometry?.coordinates as [number, number][] | undefined;
    if (!coords?.length) continue;
    const cong = route.legs?.[0]?.annotation?.congestion;
    alternatives.push({
      index: i,
      route,
      coordinates: coords,
      trafficRouteGeoJson: buildTrafficColoredRouteGeoJson(coords, cong),
    });
  }
  if (!alternatives.length) return null;

  const scored = routes.map((route, index) => ({
    route,
    index,
    score: scoreRoute(route, truckType),
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const coords = best.route.geometry?.coordinates as [number, number][] | undefined;
  if (!coords?.length) return null;

  const congestion = best.route.legs?.[0]?.annotation?.congestion;
  const trafficRouteGeoJson = buildTrafficColoredRouteGeoJson(coords, congestion);

  const summaries: ScoredRouteSummary[] = scored.map((s) => {
    const distanceKm = s.route.distance / 1000;
    const fuelCost = fuelCostCadForDistanceKm(truckType, distanceKm, fuelPL);
    return {
      index: s.index,
      durationSec: s.route.duration,
      distanceM: s.route.distance,
      score: Math.round(s.score * 10) / 10,
      etaLabel: formatEta(s.route.duration),
      distanceLabel: formatDistanceM(s.route.distance),
      fuelCostLabel: formatMoneyCad(fuelCost),
      congestionNote: congestionNoteForRoute(s.route),
    };
  });

  const selectedIndex = best.index;
  const torontoWarnings = applyTorontoIntelligence(best.route, new Date());

  return {
    route: best.route,
    coordinates: coords,
    trafficRouteGeoJson,
    truckType,
    summaries,
    selectedIndex,
    torontoWarnings,
    alternatives,
  };
}
