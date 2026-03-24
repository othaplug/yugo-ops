/**
 * Mapbox Directions — traffic-aware routing + congestion/closure annotations.
 * Uses mapbox/driving-traffic vs mapbox/driving for delay estimate (A).
 * Leg annotations for congestion + closure (B).
 */

import { geocode, mapboxToken } from "@/lib/mapbox/driving-distance";

const MAPBOX_BASE = "https://api.mapbox.com";

export type DrivingTrafficBrief = {
  distanceKm: number;
  /** Current traffic-aware estimate (minutes) */
  durationTrafficMin: number;
  /** Free-flow / non-traffic profile estimate (minutes) */
  durationBaselineMin: number;
  /** Positive = extra minutes vs baseline */
  trafficDelayMin: number;
  congestionSummary: "light" | "mixed" | "heavy" | "unknown";
  /** Live-traffic closure segments along route (if any) */
  closureCount: number;
  closureNotes: string[];
  /** Single line for UI */
  trafficSummaryLine: string;
};

type DirectionsRoute = {
  duration?: number;
  distance?: number;
  legs?: {
    annotation?: {
      congestion?: string[];
      congestion_numeric?: number[];
      closure?: unknown;
    };
  }[];
};

function coordsPath(from: { lng: number; lat: number }, to: { lng: number; lat: number }): string {
  return `${from.lng},${from.lat};${to.lng},${to.lat}`;
}

async function fetchDirections(
  profile: "driving" | "driving-traffic",
  path: string,
  params: Record<string, string>
): Promise<DirectionsRoute | null> {
  const token = mapboxToken();
  if (!token) return null;
  const q = new URLSearchParams({ access_token: token, ...params });
  const url = `${MAPBOX_BASE}/directions/v5/mapbox/${profile}/${path}?${q.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const route = json?.routes?.[0] as DirectionsRoute | undefined;
  return route ?? null;
}

function summarizeCongestion(levels: string[] | undefined): "light" | "mixed" | "heavy" | "unknown" {
  if (!levels?.length) return "unknown";
  if (levels.some((l) => l === "severe" || l === "heavy")) return "heavy";
  if (levels.some((l) => l === "moderate")) return "mixed";
  return "light";
}

function parseClosures(raw: unknown): string[] {
  if (!raw) return [];
  const notes: string[] = [];
  if (Array.isArray(raw)) {
    if (raw.length && typeof raw[0] === "boolean") {
      const closed = raw.filter((x) => x === true).length;
      if (closed > 0) {
        notes.push(
          closed === 1
            ? "Live traffic reports a closure on part of this route"
            : `Live traffic reports closures on ${closed} parts of this route`,
        );
      }
      return notes;
    }
    for (const c of raw) {
      if (c && typeof c === "object") {
        const o = c as Record<string, unknown>;
        const names = o.affected_road_names;
        if (Array.isArray(names) && names.length) {
          notes.push(`Closure affecting: ${names.slice(0, 3).join(", ")}${names.length > 3 ? "…" : ""}`);
        } else if (typeof o.description === "string") {
          notes.push(o.description);
        } else {
          notes.push("Road closure on route");
        }
      }
    }
  }
  return notes.slice(0, 5);
}

/**
 * Pickup → drop-off: traffic duration vs baseline, congestion, closures.
 */
export async function getDrivingTrafficBrief(
  fromAddress: string,
  toAddress: string
): Promise<DrivingTrafficBrief | null> {
  const from = fromAddress?.trim();
  const to = toAddress?.trim();
  if (!from || !to) return null;

  const [fromGeo, toGeo] = await Promise.all([geocode(from), geocode(to)]);
  if (!fromGeo || !toGeo) return null;

  const path = coordsPath(
    { lng: fromGeo.lng, lat: fromGeo.lat },
    { lng: toGeo.lng, lat: toGeo.lat }
  );

  const [baseline, trafficFull] = await Promise.all([
    fetchDirections("driving", path, { overview: "false" }),
    fetchDirections("driving-traffic", path, {
      overview: "full",
      geometries: "geojson",
      annotations: "congestion,closure,duration,distance",
    }),
  ]);

  if (!trafficFull?.duration) return null;

  const durationTrafficMin = Math.round(trafficFull.duration / 60);
  const durationBaselineMin = baseline?.duration != null ? Math.round(baseline.duration / 60) : durationTrafficMin;
  const trafficDelayMin = Math.max(0, durationTrafficMin - durationBaselineMin);
  const distanceKm = trafficFull.distance != null ? Math.round((trafficFull.distance / 1000) * 10) / 10 : 0;

  const leg = trafficFull.legs?.[0];
  const congestion = leg?.annotation?.congestion;
  const congestionSummary = summarizeCongestion(congestion);
  const closureNotes = parseClosures(leg?.annotation?.closure);
  const closureCount = closureNotes.length;

  let trafficSummaryLine = `${distanceKm} km · ~${durationTrafficMin} min drive`;
  if (trafficDelayMin >= 5) {
    trafficSummaryLine += `, expect ~${trafficDelayMin} min extra due to traffic`;
  } else if (trafficDelayMin >= 3) {
    trafficSummaryLine += `, minor delays (~${trafficDelayMin} min)`;
  }
  if (congestionSummary === "heavy") {
    trafficSummaryLine += " · Heavy traffic, allow buffer time";
  } else if (congestionSummary === "mixed") {
    trafficSummaryLine += " · Moderate traffic";
  } else if (congestionSummary === "light") {
    trafficSummaryLine += " · Traffic is flowing well";
  }
  if (closureCount > 0) {
    trafficSummaryLine += ` · ${closureCount} road closure${closureCount > 1 ? "s" : ""} reported`;
  }

  return {
    distanceKm,
    durationTrafficMin,
    durationBaselineMin,
    trafficDelayMin,
    congestionSummary,
    closureCount,
    closureNotes,
    trafficSummaryLine,
  };
}
