import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { getFirstStatus } from "@/lib/crew-tracking-status";
import { getPlatformToggles } from "@/lib/platform-settings";

export async function POST(req: NextRequest) {
  const toggles = await getPlatformToggles();
  if (!toggles.crew_tracking) {
    return NextResponse.json({ error: "Crew GPS tracking is disabled" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { jobId, jobType } = body;
  if (!jobId || !jobType || !["move", "delivery"].includes(jobType)) {
    return NextResponse.json({ error: "jobId and jobType (move|delivery) required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve jobId to entity (could be UUID or short code)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  let entityId: string;
  let resolvedJobId: string;

  if (jobType === "move") {
    const { data: move } = isUuid
      ? await admin.from("moves").select("id, move_code, crew_id").eq("id", jobId).single()
      : await admin.from("moves").select("id, move_code, crew_id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });
    if (move.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not assigned to your team" }, { status: 403 });
    entityId = move.id;
    resolvedJobId = move.move_code || move.id;
  } else {
    const { data: delivery } = isUuid
      ? await admin.from("deliveries").select("id, delivery_number, crew_id").eq("id", jobId).single()
      : await admin.from("deliveries").select("id, delivery_number, crew_id").ilike("delivery_number", jobId).single();
    if (!delivery) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (delivery.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not assigned to your team" }, { status: 403 });
    entityId = delivery.id;
    resolvedJobId = delivery.delivery_number || delivery.id;
  }

  // Check for existing active session
  const { data: existing } = await admin
    .from("tracking_sessions")
    .select("id")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ sessionId: existing.id, alreadyActive: true });
  }

  const firstStatus = getFirstStatus(jobType);
  const now = new Date().toISOString();
  const checkpoint = { status: firstStatus, timestamp: now, lat: null, lng: null, note: null };

  const { data: session, error } = await admin
    .from("tracking_sessions")
    .insert({
      job_id: entityId,
      job_type: jobType,
      team_id: payload.teamId,
      crew_lead_id: payload.crewMemberId,
      status: firstStatus,
      is_active: true,
      started_at: now,
      checkpoints: [checkpoint],
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ sessionId: session.id });
}
