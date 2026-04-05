import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { getFirstStatus } from "@/lib/crew-tracking-status";
import { notifyOnCheckpoint } from "@/lib/tracking-notifications";
import { applyEstateServiceChecklistAutomation } from "@/lib/estate-service-checklist-sync";
import { fetchCrewAssignmentSnapshot } from "@/lib/crew-job-snapshot";
import { CREW_JOB_UUID_RE, normalizeCrewJobId, selectDeliveryByJobId } from "@/lib/resolve-delivery-by-job-id";

export async function POST(req: NextRequest) {
  // Job sessions always allowed for assigned crew; `crew_tracking` toggle only gates live GPS ingest (see /api/tracking/location).

  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { jobType } = body;
  const rawJobId = normalizeCrewJobId(body.jobId);
  if (!rawJobId || !jobType || !["move", "delivery"].includes(jobType)) {
    return NextResponse.json({ error: "jobId and jobType (move|delivery) required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve jobId to entity (could be UUID or short code)
  const isUuid = CREW_JOB_UUID_RE.test(rawJobId);
  let entityId: string;

  type JobSnapRow = {
    id: string;
    move_code?: string | null;
    delivery_number?: string | null;
    crew_id: string | null;
    assigned_members?: unknown;
    assigned_crew_name?: string | null;
  };

  let jobRow: JobSnapRow;

  if (jobType === "move") {
    const { data: move } = isUuid
      ? await admin.from("moves").select("id, move_code, crew_id, assigned_members, assigned_crew_name").eq("id", rawJobId).maybeSingle()
      : await admin
          .from("moves")
          .select("id, move_code, crew_id, assigned_members, assigned_crew_name")
          .ilike("move_code", rawJobId.replace(/^#/, "").toUpperCase())
          .maybeSingle();
    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });
    if (move.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not assigned to your team" }, { status: 403 });
    jobRow = move as JobSnapRow;
    entityId = move.id;
  } else {
    // Do not select assigned_* — older DBs may not have those columns (see migration job_crew_assignment_snapshot).
    const selectCols = "id, delivery_number, crew_id";
    const { data: deliveryData } = await selectDeliveryByJobId(admin, rawJobId, selectCols);
    const delivery = (deliveryData as unknown as JobSnapRow | null) ?? null;
    if (!delivery) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (delivery.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not assigned to your team" }, { status: 403 });
    jobRow = delivery as JobSnapRow;
    entityId = delivery.id;
  }

  if (jobRow.crew_id) {
    const am = Array.isArray(jobRow.assigned_members) ? jobRow.assigned_members : [];
    const nameMissing = !String(jobRow.assigned_crew_name || "").trim();
    const membersMissing = am.length === 0;
    if (membersMissing || nameMissing) {
      const snap = await fetchCrewAssignmentSnapshot(admin, jobRow.crew_id);
      const patch: Record<string, unknown> = {};
      if (membersMissing) patch.assigned_members = snap.assigned_members;
      if (nameMissing) patch.assigned_crew_name = snap.assigned_crew_name;
      if (Object.keys(patch).length) {
        const tbl = jobType === "move" ? "moves" : "deliveries";
        const { error: patchErr } = await admin.from(tbl).update(patch).eq("id", entityId);
        // Deliveries may not have assigned_* columns until migration is applied (Postgres 42703).
        if (patchErr && String(patchErr.code) !== "42703") {
          return NextResponse.json({ error: patchErr.message }, { status: 500 });
        }
      }
    }
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

  // Set move/delivery to in_progress and stage so client track page shows live map and progress
  const table = jobType === "move" ? "moves" : "deliveries";
  await admin.from(table).update({
    status: "in_progress",
    stage: firstStatus,
    updated_at: now,
    eta_tracking_active: true,
  }).eq("id", entityId);

  if (jobType === "move") {
    applyEstateServiceChecklistAutomation(admin, entityId).catch((e) =>
      console.error("[tracking/start] estate checklist sync failed:", e),
    );
  }

  // Fire-and-forget: send "Crew Departed" SMS (ETA system)
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  fetch(`${origin.replace(/\/$/, "")}/api/eta/send-departure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: entityId, jobType }),
  }).catch((e) => console.error("[eta] send-departure failed:", e));

  // Notify client when crew starts job (en route to pickup) — email at start, not at arrive at pickup
  let teamName = "";
  let jobName = "";
  let fromAddress: string | undefined;
  let toAddress: string | undefined;
  const { data: crew } = await admin.from("crews").select("name").eq("id", payload.teamId).single();
  teamName = crew?.name || "Crew";
  if (jobType === "move") {
    const { data: m } = await admin.from("moves").select("client_name, from_address, to_address").eq("id", entityId).single();
    jobName = m?.client_name || entityId;
    fromAddress = m?.from_address;
    toAddress = m?.to_address;
  } else {
    const { data: d } = await admin.from("deliveries").select("customer_name, client_name, pickup_address, delivery_address").eq("id", entityId).single();
    jobName = d ? `${d.customer_name || ""} (${d.client_name || ""})` : entityId;
    fromAddress = d?.pickup_address;
    toAddress = d?.delivery_address;
  }
  notifyOnCheckpoint(firstStatus as Parameters<typeof notifyOnCheckpoint>[0], entityId, jobType, teamName, jobName, fromAddress, toAddress).catch(() => {});

  return NextResponse.json({ sessionId: session.id });
}
