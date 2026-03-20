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

/** Driving route distance (km) and duration (minutes). */
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
