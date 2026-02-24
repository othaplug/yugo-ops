import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSuperAdminEmail } from "@/lib/super-admin";

const MAPBOX_TOKEN =
  process.env.MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "";

async function geocodeAddress(address: string): Promise<{ lng: number; lat: number } | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&types=address,place&limit=1`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lng: coords[0], lat: coords[1] };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * GET /api/admin/moves/distance-matrix?from=ADDRESS&to=ADDRESS
 * Returns distance and drive time between two addresses using Mapbox Directions API.
 * Requires MAPBOX_ACCESS_TOKEN or NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("id")
    .eq("user_id", user!.id)
    .single();

  const isSuperAdmin = (user!.email || "").toLowerCase() === getSuperAdminEmail();
  if (!platformUser && !isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const from = req.nextUrl.searchParams.get("from")?.trim();
  const to = req.nextUrl.searchParams.get("to")?.trim();

  if (!from || !to) {
    return NextResponse.json({ error: "Missing from or to address" }, { status: 400 });
  }

  if (!MAPBOX_TOKEN) {
    return NextResponse.json({ distance: null, duration: null });
  }

  try {
    const [origin, dest] = await Promise.all([geocodeAddress(from), geocodeAddress(to)]);
    if (!origin || !dest) {
      return NextResponse.json(
        { error: "Could not geocode one or both addresses", distance: null, duration: null },
        { status: 200 }
      );
    }

    const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    const data = await res.json();

    const route = data.routes?.[0];
    if (!route) {
      return NextResponse.json(
        { error: "Route not found", distance: null, duration: null },
        { status: 200 }
      );
    }

    const distanceMeters = route.distance ?? 0;
    const durationSeconds = route.duration ?? 0;
    const distanceText = distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${Math.round(distanceMeters)} m`;
    const durationText = durationSeconds >= 60 ? `${Math.round(durationSeconds / 60)} min` : `${Math.round(durationSeconds)} sec`;

    return NextResponse.json({
      distance: distanceText,
      duration: durationText,
    });
  } catch (err) {
    console.error("[distance-matrix]", err);
    return NextResponse.json(
      { error: "Failed to fetch distance", distance: null, duration: null },
      { status: 200 }
    );
  }
}
