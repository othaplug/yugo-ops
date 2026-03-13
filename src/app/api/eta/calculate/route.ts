import { NextRequest, NextResponse } from "next/server";

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { crewLat, crewLng, destLat, destLng } = body;

    if (crewLat == null || crewLng == null || destLat == null || destLng == null) {
      return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
    }

    const lat1 = Number(crewLat);
    const lng1 = Number(crewLng);
    const lat2 = Number(destLat);
    const lng2 = Number(destLng);

    if (!MAPBOX_TOKEN) {
      return NextResponse.json({ error: "Mapbox token not configured" }, { status: 500 });
    }

    // Mapbox Directions API uses lng,lat order
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${lng1},${lat1};${lng2},${lat2}?access_token=${MAPBOX_TOKEN}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.code === "NoRoute" || !data.routes?.[0]) {
      return NextResponse.json({ error: "Could not calculate ETA" }, { status: 500 });
    }

    const route = data.routes[0];
    const durationSeconds = route.duration ?? 0;
    const distanceMeters = route.distance ?? 0;

    return NextResponse.json({
      etaMinutes: Math.ceil(durationSeconds / 60),
      etaSeconds: durationSeconds,
      distanceMeters,
      source: "mapbox",
    });
  } catch (error) {
    console.error("ETA calculation error:", error);
    return NextResponse.json({ error: "ETA calculation failed" }, { status: 500 });
  }
}
