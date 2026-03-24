/**
 * Mapbox driving distance for quote previews and pricing (server-only).
 */

const MAPBOX_BASE = "https://api.mapbox.com";

export function mapboxToken(): string {
  return (
    process.env.MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    ""
  );
}

export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const token = mapboxToken();
  if (!token) return null;
  const url = `${MAPBOX_BASE}/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1&country=ca`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const feat = json.features?.[0];
  if (!feat) return null;
  const [lng, lat] = feat.center;
  return { lat, lng };
}

/** Driving route distance (km) and duration (minutes) between two addresses. */
export async function getDrivingDistance(
  fromAddr: string,
  toAddr: string,
): Promise<{ distance_km: number; drive_time_min: number } | null> {
  const trimmedFrom = fromAddr?.trim();
  const trimmedTo = toAddr?.trim();
  if (!trimmedFrom || !trimmedTo) return null;
  const [fromGeo, toGeo] = await Promise.all([geocode(trimmedFrom), geocode(trimmedTo)]);
  if (!fromGeo || !toGeo) return null;
  const token = mapboxToken();
  const url = `${MAPBOX_BASE}/directions/v5/mapbox/driving/${fromGeo.lng},${fromGeo.lat};${toGeo.lng},${toGeo.lat}?access_token=${token}&overview=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) return null;
  return {
    distance_km: Math.round((route.distance / 1000) * 10) / 10,
    drive_time_min: Math.round(route.duration / 60),
  };
}

/**
 * Multi-stop driving distance: sums all legs (stop[0] → stop[1] → … → stop[n]).
 * Used when a move or delivery has additional pickup/dropoff stops.
 * Falls back to the straight-line Haversine sum if Mapbox fails for any leg.
 */
export async function getMultiStopDrivingDistance(
  addresses: string[],
): Promise<{ distance_km: number; drive_time_min: number } | null> {
  const trimmed = addresses.map((a) => a?.trim()).filter(Boolean);
  if (trimmed.length < 2) return null;

  // For 2 stops just use the existing function
  if (trimmed.length === 2) return getDrivingDistance(trimmed[0], trimmed[1]);

  // Geocode all addresses in parallel
  const geos = await Promise.all(trimmed.map((a) => geocode(a)));
  if (geos.some((g) => !g)) return null;
  const validGeos = geos as { lat: number; lng: number }[];

  const token = mapboxToken();
  if (!token) return null;

  // Mapbox Directions supports up to 25 waypoints in one call
  const coordStr = validGeos.map((g) => `${g.lng},${g.lat}`).join(";");
  const url = `${MAPBOX_BASE}/directions/v5/mapbox/driving/${coordStr}?access_token=${token}&overview=false`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Mapbox directions failed");
    const json = await res.json();
    const route = json.routes?.[0];
    if (!route) throw new Error("No route returned");
    return {
      distance_km: Math.round((route.distance / 1000) * 10) / 10,
      drive_time_min: Math.round(route.duration / 60),
    };
  } catch {
    // Fallback: sum Haversine distances between consecutive stops
    let totalKm = 0;
    for (let i = 0; i < validGeos.length - 1; i++) {
      const a = validGeos[i];
      const b = validGeos[i + 1];
      const R = 6371;
      const dLat = ((b.lat - a.lat) * Math.PI) / 180;
      const dLng = ((b.lng - a.lng) * Math.PI) / 180;
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) *
          Math.cos((b.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      totalKm += R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }
    return {
      distance_km: Math.round(totalKm * 10) / 10,
      drive_time_min: Math.round((totalKm / 50) * 60),
    };
  }
}
