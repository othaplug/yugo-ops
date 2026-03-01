import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const MAPBOX_TOKEN =
  process.env.MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

/**
 * GET /api/mapbox/geocode?q=ADDRESS
 * Proxies Mapbox Geocoding API for address autocomplete. Returns GeoJSON FeatureCollection.
 */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "8", 10), 10);
  const country = req.nextUrl.searchParams.get("country") || "";

  if (!q || q.length < 2) {
    return NextResponse.json({ type: "FeatureCollection", features: [] });
  }

  if (!MAPBOX_TOKEN) {
    return NextResponse.json(
      { error: "Mapbox token not configured", type: "FeatureCollection", features: [] },
      { status: 200 }
    );
  }

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      types: "address,place",
      limit: String(limit),
    });
    if (country) params.set("country", country);

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { type: "FeatureCollection", features: [], error: data.message || "Geocoding failed" },
        { status: 200 }
      );
    }

    return NextResponse.json({
      type: data.type || "FeatureCollection",
      query: data.query,
      features: data.features || [],
    });
  } catch (err) {
    console.error("[mapbox/geocode]", err);
    return NextResponse.json(
      { type: "FeatureCollection", features: [], error: "Failed to geocode" },
      { status: 200 }
    );
  }
}
