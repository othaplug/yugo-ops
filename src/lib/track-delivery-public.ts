/** Serializable multi-stop data for public delivery track pages (no server-only imports). */

export type TrackPublicStopLine = {
  description: string;
  quantity: number;
};

export type TrackPublicStop = {
  stopNumber: number;
  kind: "pickup" | "delivery";
  address: string;
  /** Vendor / contact hint, never raw DB enums */
  subtitle: string | null;
  lineItems: TrackPublicStopLine[];
};

export function stopKindFromRow(row: {
  stop_type?: string | null;
  is_final_destination?: boolean | null;
}): "pickup" | "delivery" {
  if (row.is_final_destination) return "delivery";
  const t = String(row.stop_type || "").toLowerCase();
  if (t === "delivery" || t === "dropoff") return "delivery";
  return "pickup";
}

export function totalUnitsFromTrackStops(stops: TrackPublicStop[]): number {
  let n = 0;
  for (const s of stops) {
    for (const li of s.lineItems) {
      n += Math.max(1, Math.floor(Number(li.quantity) || 1));
    }
  }
  return n;
}

export function pickupCountFromTrackStops(stops: TrackPublicStop[]): number {
  return stops.filter((s) => s.kind === "pickup").length;
}

/** Geocoded point order matches `TrackPublicStop` order (skips stops that failed to geocode). */
export type TrackRoutePlanPoint = {
  lat: number;
  lng: number;
  /** "1", "2", … for pickups, "D" for final delivery */
  label: string;
  kind: "pickup" | "delivery";
};
