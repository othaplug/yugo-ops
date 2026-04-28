import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type TrackPublicStop,
  type TrackRoutePlanPoint,
  stopKindFromRow,
} from "@/lib/track-delivery-public";

type Coord = { lat: number; lng: number };

type StopRow = {
  id: string;
  stop_number: number;
  address: string;
  stop_type?: string | null;
  vendor_name?: string | null;
  customer_name?: string | null;
  is_final_destination?: boolean | null;
  items_description?: string | null;
};

export async function loadTrackDeliveryPublicData(
  supabase: SupabaseClient,
  deliveryId: string,
  isMultiStop: boolean,
  geocode: (address: string) => Promise<Coord | null>,
): Promise<{ trackStops: TrackPublicStop[] | null; routePlan: TrackRoutePlanPoint[] | null }> {
  if (!isMultiStop) {
    return { trackStops: null, routePlan: null };
  }

  const { data: stops, error } = await supabase
    .from("delivery_stops")
    .select(
      "id, stop_number, address, stop_type, vendor_name, customer_name, is_final_destination, items_description",
    )
    .eq("delivery_id", deliveryId)
    .order("stop_number");

  if (error || !stops?.length) {
    return { trackStops: null, routePlan: null };
  }

  const typed = stops as StopRow[];
  const ids = typed.map((s) => s.id);
  const { data: itemRows } = await supabase
    .from("delivery_stop_items")
    .select("stop_id, description, quantity")
    .in("stop_id", ids);

  const byStop = new Map<string, { description: string; quantity: number }[]>();
  for (const r of itemRows || []) {
    const sid = String((r as { stop_id?: string }).stop_id || "");
    if (!sid) continue;
    const desc = String((r as { description?: string }).description || "").trim();
    if (!desc) continue;
    const qty = Math.max(1, Math.floor(Number((r as { quantity?: number }).quantity) || 1));
    const arr = byStop.get(sid) ?? [];
    arr.push({ description: desc, quantity: qty });
    byStop.set(sid, arr);
  }

  const trackStops: TrackPublicStop[] = typed.map((s) => {
    const kind = stopKindFromRow(s);
    const fromItems = byStop.get(s.id) ?? [];
    const lineItems =
      fromItems.length > 0
        ? fromItems
        : String(s.items_description || "").trim()
          ? [
              {
                description: String(s.items_description).trim(),
                quantity: 1,
              },
            ]
          : [];

    const subtitle =
      kind === "pickup"
        ? (s.vendor_name || s.customer_name || "").trim() || null
        : (s.customer_name || "").trim() || null;

    return {
      stopNumber: s.stop_number,
      kind,
      address: String(s.address || "").trim(),
      subtitle,
      lineItems,
    };
  });

  const coords = await Promise.all(
    typed.map((s) => (String(s.address || "").trim() ? geocode(String(s.address).trim()) : null)),
  );

  let pickupIdx = 0;
  const routePlan: TrackRoutePlanPoint[] = [];
  for (let i = 0; i < typed.length; i++) {
    const c = coords[i];
    if (!c) continue;
    const kind = stopKindFromRow(typed[i]);
    const label = kind === "delivery" ? "D" : String(++pickupIdx);
    routePlan.push({ lat: c.lat, lng: c.lng, label, kind });
  }

  return {
    trackStops,
    routePlan: routePlan.length >= 2 ? routePlan : null,
  };
}
