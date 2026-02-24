import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

const VALID_SKIP_REASONS = [
  "client_not_home",
  "client_refused",
  "client_requested_delay",
  "emergency",
  "other",
];

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const jobId = (body.jobId || "").toString().trim();
  const jobType = (body.jobType || "move").toString().trim();
  const skipReason = (body.skipReason || "").toString().trim();
  const skipNote = (body.skipNote || "").toString().trim() || null;
  const locationLat = typeof body.locationLat === "number" ? body.locationLat : null;
  const locationLng = typeof body.locationLng === "number" ? body.locationLng : null;

  if (!jobId || !["move", "delivery"].includes(jobType)) {
    return NextResponse.json({ error: "jobId and jobType required" }, { status: 400 });
  }
  if (!skipReason || !VALID_SKIP_REASONS.includes(skipReason)) {
    return NextResponse.json({ error: "Valid skip reason required" }, { status: 400 });
  }
  if (skipReason === "other" && !skipNote) {
    return NextResponse.json({ error: "Note required when reason is 'other'" }, { status: 400 });
  }

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  let entityId = jobId;

  if (jobType === "move") {
    const { data: m } = isUuid
      ? await admin.from("moves").select("id, move_code, crew_id").eq("id", jobId).single()
      : await admin.from("moves").select("id, move_code, crew_id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
    if (!m || m.crew_id !== payload.teamId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    entityId = m.id;
  } else {
    const { data: d } = isUuid
      ? await admin.from("deliveries").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("deliveries").select("id, crew_id").ilike("delivery_number", jobId).single();
    if (!d || d.crew_id !== payload.teamId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    entityId = d.id;
  }

  // Record detailed skip in signoff_skips table
  await admin.from("signoff_skips").insert({
    job_id: entityId,
    job_type: jobType,
    team_id: payload.teamId,
    crew_member_id: payload.crewMemberId,
    skip_reason: skipReason,
    skip_note: skipNote,
    location_lat: locationLat,
    location_lng: locationLng,
  });

  // Also log a status event
  const reasonLabels: Record<string, string> = {
    client_not_home: "Client not home",
    client_refused: "Client refused to sign",
    client_requested_delay: "Client requested delay",
    emergency: "Emergency",
    other: "Other",
  };
  try {
    await admin.from("status_events").insert({
      entity_type: jobType,
      entity_id: entityId,
      event_type: "signoff_skipped",
      description: `Sign-off skipped: ${reasonLabels[skipReason] || skipReason}${skipNote ? ` — ${skipNote}` : ""}`,
      icon: "user-x",
    });
  } catch {}

  // Complete the job when sign-off is skipped
  const { data: activeSession } = await admin
    .from("tracking_sessions")
    .select("id")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .eq("is_active", true)
    .maybeSingle();

  if (activeSession) {
    const now = new Date().toISOString();
    await admin
      .from("tracking_sessions")
      .update({ status: "completed", is_active: false, completed_at: now, updated_at: now })
      .eq("id", activeSession.id);
    const table = jobType === "move" ? "moves" : "deliveries";
    await admin
      .from(table)
      .update({
        status: jobType === "move" ? "completed" : "delivered",
        stage: "completed",
        updated_at: now,
      })
      .eq("id", entityId);
  }

  return NextResponse.json({ ok: true });
}
