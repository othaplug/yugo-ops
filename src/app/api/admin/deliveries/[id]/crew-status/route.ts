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
      { liveStage, sessionId, hasActiveTracking, crewId: delivery.crew_id },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
