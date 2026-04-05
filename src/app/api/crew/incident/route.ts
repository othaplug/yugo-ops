import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { notifyAllAdmins } from "@/lib/notifications";
import {
  defaultUrgencyForIssue,
  labelForIssueCode,
  MOVE_DAY_ISSUE_OPTIONS,
} from "@/lib/crew/move-day-issues";

const ALLOWED_ISSUE_TYPES = new Set(MOVE_DAY_ISSUE_OPTIONS.map((o) => o.code));

/** POST: Report an incident from crew portal */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    jobId,
    jobType,
    sessionId,
    issueType,
    description,
    urgency: urgencyRaw,
    photoUrls,
  } = body as {
    jobId?: string;
    jobType?: string;
    sessionId?: string | null;
    issueType?: string;
    description?: string;
    urgency?: string;
    photoUrls?: string[];
  };

  if (!jobId || !jobType || !issueType) {
    return NextResponse.json({ error: "jobId, jobType, issueType required" }, { status: 400 });
  }
  if (!ALLOWED_ISSUE_TYPES.has(issueType)) {
    return NextResponse.json({ error: "Invalid issueType" }, { status: 400 });
  }

  const urgency =
    urgencyRaw === "high" || urgencyRaw === "low" || urgencyRaw === "medium"
      ? urgencyRaw
      : defaultUrgencyForIssue(issueType);

  const photos = Array.isArray(photoUrls)
    ? photoUrls.filter((u) => typeof u === "string" && u.trim()).slice(0, 8)
    : [];

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);

  let entityId: string;
  if (jobType === "delivery") {
    const { data: d } = isUuid
      ? await admin.from("deliveries").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("deliveries").select("id, crew_id").ilike("delivery_number", jobId).single();
    if (!d || d.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    entityId = d.id;
  } else {
    const { data: m } = isUuid
      ? await admin.from("moves").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("moves").select("id, crew_id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
    if (!m || m.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    entityId = m.id;
  }

  const { data: incident, error } = await admin
    .from("incidents")
    .insert({
      job_id: entityId,
      job_type: jobType,
      session_id: sessionId || null,
      crew_member_id: payload.crewMemberId,
      issue_type: issueType,
      description: (description || "").trim() || null,
      urgency,
      status: "open",
      photo_urls: photos,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const label = labelForIssueCode(issueType);
  const desc = (description || "").trim();
  const summary = desc ? `${label}: ${desc}` : label;

  if (jobType === "move") {
    await notifyAdmins("move_issue", {
      moveId: entityId,
      sourceId: entityId,
      subject: `Crew reported: ${label}`,
      description: summary,
    }).catch(() => {});
  } else {
    await notifyAllAdmins({
      title: `Delivery issue: ${label}`,
      body: summary,
      icon: "warning",
      sourceType: "delivery",
      sourceId: entityId,
      link: `/admin/deliveries/${entityId}`,
      eventSlug: "move_issue",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: incident.id });
}
