/**
 * Zone detection for B2B flat-band rate card pricing.
 * Zone is determined by straight-line (haversine) distance from
 * 507 King St E, Toronto (43.6510, -79.3583).
 */

export type B2BZone = "gta" | "extended_gta" | "regional_ontario" | "custom";

/** Yugo office reference point for zone calculations */
const HY_OFFICE = { lat: 43.651, lng: -79.3583 };

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Determine zone from delivery lat/lng coordinates. */
export function getZone(deliveryLat: number, deliveryLng: number): B2BZone {
  const km = haversineKm(
    HY_OFFICE.lat,
    HY_OFFICE.lng,
    deliveryLat,
    deliveryLng,
  );
  if (km <= 50) return "gta";
  if (km <= 100) return "extended_gta";
  if (km <= 160) return "regional_ontario";
  return "custom";
}

/**
 * Fallback zone detection when lat/lng not available.
 * Uses straight-line km already computed from GTA core (Mapbox geocode).
 */
export function getZoneFromDistance(distanceKm: number): B2BZone {
  if (distanceKm <= 50) return "gta";
  if (distanceKm <= 100) return "extended_gta";
  if (distanceKm <= 160) return "regional_ontario";
  return "custom";
}
