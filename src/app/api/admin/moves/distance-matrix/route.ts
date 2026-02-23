import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSuperAdminEmail } from "@/lib/super-admin";

/**
 * GET /api/admin/moves/distance-matrix?from=ADDRESS&to=ADDRESS
 * Returns distance and drive time between two addresses using Google Distance Matrix API.
 * Requires GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Enable Distance Matrix API in Google Cloud.
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

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ distance: null, duration: null });
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", from);
    url.searchParams.set("destinations", to);
    url.searchParams.set("units", "metric");
    url.searchParams.set("mode", "driving");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { next: { revalidate: 0 } });
    const data = await res.json();

    if (data.status !== "OK") {
      return NextResponse.json(
        { error: data.error_message || data.status, distance: null, duration: null },
        { status: 200 }
      );
    }

    const row = data.rows?.[0];
    const element = row?.elements?.[0];

    if (!element || element.status !== "OK") {
      return NextResponse.json(
        { error: "Route not found", distance: null, duration: null },
        { status: 200 }
      );
    }

    const distanceText = element.distance?.text ?? `${(element.distance?.value ?? 0) / 1000} km`;
    const durationText = element.duration?.text ?? `${Math.round((element.duration?.value ?? 0) / 60)} min`;

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
