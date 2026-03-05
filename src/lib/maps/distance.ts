import { createAdminClient } from "@/lib/supabase/admin";

const MAPBOX_BASE = "https://api.mapbox.com";

function mapboxToken(): string {
  return (
    process.env.MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
    ""
  );
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distance_km: number;
  drive_time_min: number;
}

export async function geocode(address: string): Promise<GeoPoint | null> {
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

/**
 * Calculate driving distance and duration between two addresses using Mapbox Directions.
 * Results are cached in the `distance_cache` table — same pair won't hit the API twice.
 */
export async function getDistance(
  fromAddress: string,
  toAddress: string,
): Promise<DistanceResult | null> {
  const fromNorm = fromAddress.trim().toLowerCase();
  const toNorm = toAddress.trim().toLowerCase();

  const supabase = createAdminClient();
  const { data: cached } = await supabase
    .from("distance_cache")
    .select("distance_km, drive_time_min")
    .eq("from_address", fromNorm)
    .eq("to_address", toNorm)
    .limit(1)
    .maybeSingle();

  if (cached) {
    return {
      distance_km: Number(cached.distance_km),
      drive_time_min: Number(cached.drive_time_min),
    };
  }

  const [fromGeo, toGeo] = await Promise.all([geocode(fromAddress), geocode(toAddress)]);
  if (!fromGeo || !toGeo) return null;

  const token = mapboxToken();
  const url = `${MAPBOX_BASE}/directions/v5/mapbox/driving/${fromGeo.lng},${fromGeo.lat};${toGeo.lng},${toGeo.lat}?access_token=${token}&overview=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) return null;

  const result: DistanceResult = {
    distance_km: Math.round((route.distance / 1000) * 10) / 10,
    drive_time_min: Math.round(route.duration / 60),
  };

  Promise.resolve(
    supabase.from("distance_cache").upsert({
      from_address: fromNorm,
      to_address: toNorm,
      distance_km: result.distance_km,
      drive_time_min: result.drive_time_min,
    }),
  ).catch(() => {});

  return result;
}

/**
 * Extract Canadian postal prefix (FSA) from an address string.
 */
export function extractPostalPrefix(address: string): string | null {
  const m = address.match(/\b([A-Z]\d[A-Z])\s*\d[A-Z]\d\b/i);
  return m ? m[1].toUpperCase() : null;
}
