import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/** GET crew live stage for admin move detail. Staff only. Used by LiveTrackingMap for status card. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id: moveId } = await params;

  try {
    const admin = createAdminClient();
    const { data: move } = await admin
      .from("moves")
      .select("id, stage")
      .eq("id", moveId)
      .single();

    if (!move) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let liveStage: string | null = move.stage || null;
    let sessionId: string | null = null;
    let hasActiveTracking = false;

    const { data: ts } = await admin
      .from("tracking_sessions")
      .select("id, status, is_active")
      .eq("job_id", moveId)
      .eq("job_type", "move")
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
      { liveStage, sessionId, hasActiveTracking },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
