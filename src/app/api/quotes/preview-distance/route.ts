import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  getDrivingDistance,
  getMultiStopDrivingDistance,
  straightLineKmFromGtaCore,
} from "@/lib/mapbox/driving-distance";

/**
 * POST body (either):
 * - { from_address, to_address } — point-to-point route + optional GTA zone from `to_address`
 * - { b2b_stops: string[] } — multi-stop route (≥2 non-empty); zone uses last stop as delivery
 */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error || !user) return error!;

  let body: { from_address?: string; to_address?: string; b2b_stops?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const stopsRaw = body.b2b_stops;
  const stops =
    Array.isArray(stopsRaw) ? stopsRaw.map((s) => String(s ?? "").trim()).filter(Boolean) : [];

  let from = "";
  let to = "";
  let result: { distance_km: number; drive_time_min: number } | null = null;

  if (stops.length >= 2) {
    result = await getMultiStopDrivingDistance(stops);
    from = stops[0]!;
    to = stops[stops.length - 1]!;
  } else {
    from = (body.from_address || "").trim();
    to = (body.to_address || "").trim();
    if (!from || !to) {
      return NextResponse.json(
        { error: "Provide from_address and to_address, or b2b_stops with at least 2 addresses" },
        { status: 400 },
      );
    }
    result = await getDrivingDistance(from, to);
  }

  if (!result) {
    return NextResponse.json({ error: "Could not compute route (check addresses / MAPBOX_TOKEN)" }, { status: 422 });
  }

  const deliveryKmFromGtaCore = await straightLineKmFromGtaCore(to);

  return NextResponse.json({
    ...result,
    delivery_km_from_gta_core: deliveryKmFromGtaCore,
  });
}
