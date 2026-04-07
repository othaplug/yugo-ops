import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/** GET crew live stage for admin delivery detail. Staff only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id: deliveryId } = await params;

  try {
    const admin = createAdminClient();
    const { data: delivery } = await admin
      .from("deliveries")
      .select("id, stage, crew_id")
      .eq("id", deliveryId)
      .single();

    if (!delivery) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let liveStage: string | null = delivery.stage || null;
    let sessionId: string | null = null;
    let hasActiveTracking = false;
    let navEtaSeconds: number | null = null;
    let navDistanceRemainingM: number | null = null;

    if (delivery.crew_id) {
      const { data: cl } = await admin
        .from("crew_locations")
        .select("nav_eta_seconds, nav_distance_remaining_m")
        .eq("crew_id", delivery.crew_id)
        .maybeSingle();
      if (cl?.nav_eta_seconds != null) navEtaSeconds = Math.round(Number(cl.nav_eta_seconds));
      if (cl?.nav_distance_remaining_m != null)
        navDistanceRemainingM = Math.round(Number(cl.nav_distance_remaining_m));
    }

    const { data: ts } = await admin
      .from("tracking_sessions")
      .select("id, status, is_active")
      .eq("job_id", deliveryId)
      .eq("job_type", "delivery")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ts) {
      liveStage = ts.status || liveStage;
      sessionId = ts.id;
      hasActiveTracking = !!ts.is_active;
    }

    return NextResponse.json(
      {
        liveStage,
        sessionId,
        hasActiveTracking,
        crewId: delivery.crew_id,
        navEtaSeconds,
        navDistanceRemainingM,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
