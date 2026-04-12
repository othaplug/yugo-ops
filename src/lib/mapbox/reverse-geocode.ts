/**
 * Mapbox reverse geocoding (coordinates to place name).
 * See https://docs.mapbox.com/api/search/geocoding/#reverse-geocoding
 */

const MAPBOX_TOKEN =
  process.env.MAPBOX_ACCESS_TOKEN ||
  process.env.MAPBOX_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

type GeocodeFeature = { place_name?: string };

type GeocodeResponse = { features?: GeocodeFeature[] };

/**
 * Returns a short human-readable label (often street + city) or null on failure.
 */
export async function reverseGeocodePlaceName(
  lat: number,
  lng: number,
): Promise<string | null> {
  if (!MAPBOX_TOKEN || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  try {
    const coord = `${lng},${lat}`;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(coord)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as GeocodeResponse;
    const name = data.features?.[0]?.place_name?.trim();
    return name || null;
  } catch {
    return null;
  }
}

/**
 * Line for alerts: "Address (lat, lng)" when geocode succeeds, else coordinates only.
 */
export function formatLastPositionLine(
  lat: number,
  lng: number,
  address: string | null,
): string {
  const coord = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const trimmed = address?.trim();
  if (trimmed) return `${trimmed} (${coord})`;
  return coord;
}
