import { haversineKm } from "@/lib/mapbox/driving-distance";

export type CrewLocationHistorySample = {
  lat: unknown;
  lng: unknown;
  speed: unknown;
  recorded_at: string;
};

/**
 * Mean driving speed (km/h) for ops reporting.
 * Geolocation `speed` is often null on mobile; when missing we derive speed from successive lat/lng fixes.
 */
export function computeAvgDrivingSpeedKmhFromHistoryRows(
  rows: CrewLocationHistorySample[] | null | undefined,
): number | null {
  const list = rows ?? [];
  if (list.length === 0) return null;

  const gpsMps: number[] = [];
  for (const r of list) {
    const sp = Number(r.speed);
    if (Number.isFinite(sp) && sp >= 0.5 && sp <= 45) {
      gpsMps.push(sp);
    }
  }

  if (gpsMps.length >= 2) {
    const avg = gpsMps.reduce((a, b) => a + b, 0) / gpsMps.length;
    return Math.round(avg * 3.6 * 10) / 10;
  }

  const sorted = [...list]
    .map((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lng),
      t: new Date(r.recorded_at).getTime(),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);

  const segKmh: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const dtSec = (b.t - a.t) / 1000;
    if (dtSec < 2.5 || dtSec > 120) continue;
    const distM = haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000;
    if (distM < 12) continue;
    const mps = distM / dtSec;
    const kmh = mps * 3.6;
    if (kmh >= 5 && kmh <= 140) segKmh.push(kmh);
  }

  if (segKmh.length >= 1) {
    const avg = segKmh.reduce((a, b) => a + b, 0) / segKmh.length;
    return Math.round(avg * 10) / 10;
  }

  if (gpsMps.length === 1) {
    return Math.round(gpsMps[0]! * 3.6 * 10) / 10;
  }

  return null;
}
