import type { MapboxDirectionRoute } from "./route-types";

export type StopForOptimization = { id: string; lat: number; lng: number; address: string };

export type OptimizeStopOrderResult = {
  optimizedStops: StopForOptimization[];
  route: MapboxDirectionRoute | null;
  savedKm: number;
  savedMinutes: number;
  savedFuelCad: number;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Naive total distance: start → stops in order (straight-line legs). */
export function estimateOrderDistanceKm(start: { lat: number; lng: number }, stops: StopForOptimization[]): number {
  if (stops.length === 0) return 0;
  let total = 0;
  let prev = start;
  for (const s of stops) {
    total += haversineKm(prev.lat, prev.lng, s.lat, s.lng);
    prev = s;
  }
  return total;
}

/**
 * Mapbox Optimization API (open trip). Requires coordinates on every stop.
 * Use when day-rate / multi-stop days need reordering; dispatch UI can call this when stops have lat/lng.
 */
export async function optimizeStopOrder(
  accessToken: string,
  startPoint: { lat: number; lng: number },
  stops: StopForOptimization[],
  options?: { returnToBase?: boolean }
): Promise<OptimizeStopOrderResult> {
  const returnToBase = Boolean(options?.returnToBase);
  if (stops.length <= 1) {
    return { optimizedStops: stops, route: null, savedKm: 0, savedMinutes: 0, savedFuelCad: 0 };
  }

  const invalid = stops.some((s) => !Number.isFinite(s.lat) || !Number.isFinite(s.lng));
  if (invalid) {
    return { optimizedStops: stops, route: null, savedKm: 0, savedMinutes: 0, savedFuelCad: 0 };
  }

  const coords: string[] = [`${startPoint.lng},${startPoint.lat}`];
  for (const s of stops) {
    coords.push(`${s.lng},${s.lat}`);
  }
  if (returnToBase) {
    coords.push(`${startPoint.lng},${startPoint.lat}`);
  }

  const params = new URLSearchParams({
    source: "first",
    geometries: "geojson",
    overview: "full",
    roundtrip: returnToBase ? "true" : "false",
    access_token: accessToken,
  });
  if (returnToBase) {
    params.set("destination", "last");
  }

  const path = coords.join(";");
  const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic/${path}?${params.toString()}`;

  try {
    const res = await fetch(url);
    const data = (await res.json()) as {
      trips?: Array<{ distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }>;
      waypoints?: Array<{ waypoint_index: number }>;
      code?: string;
    };

    const trip = data.trips?.[0];
    const waypoints = data.waypoints;
    if (!trip || !waypoints?.length) {
      return { optimizedStops: stops, route: null, savedKm: 0, savedMinutes: 0, savedFuelCad: 0 };
    }

    /** API returns waypoints in visit order; `waypoint_index` maps to the input coordinate list. */
    const optimizedStops: StopForOptimization[] = [];
    const lastCoordIdx = coords.length - 1;
    for (const wp of waypoints) {
      const idx = wp.waypoint_index;
      if (idx <= 0) continue;
      if (returnToBase && idx === lastCoordIdx) continue;
      const stop = stops[idx - 1];
      if (stop) optimizedStops.push(stop);
    }

    if (optimizedStops.length !== stops.length) {
      return { optimizedStops: stops, route: null, savedKm: 0, savedMinutes: 0, savedFuelCad: 0 };
    }

    const originalKm = estimateOrderDistanceKm(startPoint, stops);
    const optimizedKm = trip.distance / 1000;
    const savedKm = Math.max(0, originalKm - optimizedKm);
    const savedMinutes = 0;
    const savedFuelCad = Math.round(savedKm * 0.18 * 1.65 * 100) / 100;

    const routeShape: MapboxDirectionRoute = {
      duration: trip.duration,
      distance: trip.distance,
      geometry: trip.geometry,
      legs: [],
    };

    return {
      optimizedStops,
      route: routeShape,
      savedKm: Math.round(savedKm * 10) / 10,
      savedMinutes,
      savedFuelCad,
    };
  } catch {
    return { optimizedStops: stops, route: null, savedKm: 0, savedMinutes: 0, savedFuelCad: 0 };
  }
}
