import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";

const MAPBOX_TOKEN =
  process.env.MAPBOX_ACCESS_TOKEN ||
  process.env.MAPBOX_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  "";

/** GET ?from=lng,lat&to=lng,lat — returns driving route geometry (GeoJSON coordinates) */
export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const rl = rateLimit(`mapbox:${user!.id}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  if (!from || !to || !MAPBOX_TOKEN) {
    return NextResponse.json({ error: "Missing from, to, or Mapbox token" }, { status: 400 });
  }
  const coords = `${from};${to}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const route = data?.routes?.[0];
    const coordsList = route?.geometry?.coordinates;
    if (!Array.isArray(coordsList) || coordsList.length === 0) {
      return NextResponse.json({ coordinates: null, duration: null, distance: null });
    }
    const duration =
      route?.duration != null && Number.isFinite(Number(route.duration))
        ? Number(route.duration)
        : null;
    const distance =
      route?.distance != null && Number.isFinite(Number(route.distance))
        ? Number(route.distance)
        : null;
    return NextResponse.json({ coordinates: coordsList, duration, distance });
  } catch (e) {
    console.error("[mapbox/directions]", e);
    return NextResponse.json({ error: "Directions failed" }, { status: 502 });
  }
}
