import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getDrivingDistance } from "@/lib/mapbox/driving-distance";

/** POST { from_address, to_address } → { distance_km, drive_time_min } for quote form previews */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth();
  if (error || !user) return error!;

  let body: { from_address?: string; to_address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const from = (body.from_address || "").trim();
  const to = (body.to_address || "").trim();
  if (!from || !to) {
    return NextResponse.json({ error: "from_address and to_address required" }, { status: 400 });
  }

  const result = await getDrivingDistance(from, to);
  if (!result) {
    return NextResponse.json({ error: "Could not compute route (check addresses / MAPBOX_TOKEN)" }, { status: 422 });
  }

  return NextResponse.json(result);
}
