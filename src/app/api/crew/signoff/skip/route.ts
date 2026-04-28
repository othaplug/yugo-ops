import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import {
  CREW_JOB_UUID_RE,
  normalizeCrewJobId,
  selectDeliveryByJobId,
} from "@/lib/resolve-delivery-by-job-id";
import { notifyJobCompletedForCrewProfiles } from "@/lib/crew/profile-after-job";
import {
  ensureJobCompleted,
  runDeliveryCompletionFollowUp,
  runMoveCompletionFollowUp,
} from "@/lib/moves/complete-move-job";

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
  const normalizedJobId = normalizeCrewJobId(jobId);
  if (!normalizedJobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }
  const isUuid = CREW_JOB_UUID_RE.test(normalizedJobId);
  let entityId: string;

  if (jobType === "move") {
    let m: { id: string; crew_id: string } | null = null;
    if (isUuid) {
      const byId = await admin
        .from("moves")
        .select("id, crew_id")
        .eq("id", normalizedJobId)
        .maybeSingle();
      if (byId.data) m = byId.data as { id: string; crew_id: string };
      else {
        const byCode = await admin
          .from("moves")
          .select("id, crew_id")
          .ilike("move_code", normalizedJobId.replace(/^#/, "").toUpperCase())
          .maybeSingle();
        m = (byCode.data as { id: string; crew_id: string } | null) ?? null;
      }
    } else {
      const byCode = await admin
        .from("moves")
        .select("id, crew_id")
        .ilike("move_code", normalizedJobId.replace(/^#/, "").toUpperCase())
        .maybeSingle();
      m = (byCode.data as { id: string; crew_id: string } | null) ?? null;
    }
    if (!m || m.crew_id !== payload.teamId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    entityId = m.id;
  } else {
    const { data: dRow, error: delErr } = await selectDeliveryByJobId(
      admin,
      normalizedJobId,
      "id, crew_id",
    );
    if (delErr) {
      console.error("[signoff/skip] delivery lookup:", delErr);
      return NextResponse.json({ error: "Could not look up this job" }, { status: 503 });
    }
    const d = dRow as { id?: string; crew_id?: string } | null;
    if (!d?.id || d.crew_id !== payload.teamId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    entityId = d.id;
  }

  const { data: insertedRows, error: skipInsertErr } = await admin
    .from("signoff_skips")
    .insert({
      job_id: entityId,
      job_type: jobType,
      team_id: payload.teamId,
      crew_member_id: payload.crewMemberId,
      skip_reason: skipReason,
      skip_note: skipNote,
      location_lat: locationLat,
      location_lng: locationLng,
    })
    .select("id");
  const insertedSkipId =
    Array.isArray(insertedRows) && insertedRows[0] && typeof (insertedRows[0] as { id?: string }).id === "string"
      ? (insertedRows[0] as { id: string }).id
      : null;
  if (skipInsertErr || !insertedSkipId) {
    console.error("[signoff/skip] signoff_skips insert:", skipInsertErr);
    return NextResponse.json(
      {
        error: "Could not save skip reason. Try again or contact the office.",
        code: "SKIP_RECORD_FAILED",
      },
      { status: 503 },
    );
  }

  const reasonLabels: Record<string, string> = {
    client_not_home: "Client not home",
    client_refused: "Client refused to sign",
    client_requested_delay: "Client requested delay",
    emergency: "Emergency",
    other: "Other",
  };

  const now = new Date().toISOString();

  const { data: activeSession } = await admin
    .from("tracking_sessions")
    .select("id, started_at")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .eq("is_active", true)
    .maybeSingle();

  const { data: latestSession } = await admin
    .from("tracking_sessions")
    .select("id, started_at")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sessionForHours = activeSession ?? latestSession;
  const sessionStartMs = sessionForHours?.started_at
    ? new Date(sessionForHours.started_at as string).getTime()
    : null;
  const actualHours =
    sessionStartMs != null
      ? Math.round(((new Date(now).getTime() - sessionStartMs) / 3_600_000) * 100) / 100
      : null;

  const { wasAlreadyComplete, ok: completeOk, error: completeErr } = await ensureJobCompleted(admin, {
    jobId: entityId,
    jobType: jobType as "move" | "delivery",
    completedAt: now,
    actualHours,
  });

  if (!completeOk) {
    console.error("[signoff/skip] ensureJobCompleted failed:", completeErr);
    await admin.from("signoff_skips").delete().eq("id", insertedSkipId);
    return NextResponse.json(
      {
        error:
          "Could not mark this job complete in the system. Try again or contact the office.",
        code: "COMPLETION_SYNC_FAILED",
      },
      { status: 503 },
    );
  }

  try {
    await admin.from("status_events").insert({
      entity_type: jobType,
      entity_id: entityId,
      event_type: "signoff_skipped",
      description: `Sign-off skipped: ${reasonLabels[skipReason] || skipReason}${skipNote ? `, ${skipNote}` : ""}`,
      icon: "user-x",
    });
  } catch {}

  if (!wasAlreadyComplete) {
    if (jobType === "move") {
      await runMoveCompletionFollowUp(admin, entityId, { source: "crew_signoff_skip" });
    } else {
      await runDeliveryCompletionFollowUp(admin, entityId);
    }
  }

  notifyJobCompletedForCrewProfiles(admin, {
    jobType: jobType as "move" | "delivery",
    jobId: entityId,
  }).catch((e) => console.error("[crew-profile] signoff skip:", e));

  return NextResponse.json({ ok: true });
}
